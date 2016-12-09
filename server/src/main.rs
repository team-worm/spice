#![feature(field_init_shorthand)]

extern crate hyper;
extern crate unicase;
extern crate reroute;

extern crate serde;
extern crate serde_json;

extern crate debug;
extern crate winapi;
extern crate kernel32;

use std::{io, fs};
use std::sync::{Mutex, Arc};
use std::io::{BufRead, Write};
use std::path::{PathBuf, Path};
use std::collections::HashMap;

use hyper::status::StatusCode;
use hyper::server::{Server, Request, Response};
use reroute::{Captures, Router};

use serde_json::value::ToJson;

use serde_types::*;
use child::{ServerMessage, DebugMessage, DebugTrace};

mod serde_types {
    include!(concat!(env!("OUT_DIR"), "/serde_types.rs"));
}

mod child;

type ChildThread = Arc<Mutex<Option<child::Thread>>>;

fn main() {
    // current child thread (only one at a time)
    let child_thread = Arc::new(Mutex::new(None));

    let mut router = Router::new();

    // host system info

    router.get(r"^/api/v1/filesystem/(.*)$", filesystem);
    router.get(r"^/api/v1/processes$", process);

    // attaching

    let child = child_thread.clone();
    router.post(r"^/api/v1/debug/attach/pid/([0-9]*)$", move |req, res, caps| {
        debug_attach_pid(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.post(r"^/api/v1/debug/attach/bin/(.*)$", move |req, res, caps| {
        debug_attach_bin(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.get(r"^/api/v1/debug$", move |req, res, caps| {
        debug(req, res, caps, child.clone());
    });

    // functions

    router.get(r"^/api/v1/debug/([0-9]*)/functions$", debug_functions);
    router.get(r"^/api/v1/debug/([0-9]*)/functions/(.*)$", debug_function);

    // breakpoints

    router.get(r"^/api/v1/debug/([0-9]*)/breakpoints$", debug_breakpoints);

    let child = child_thread.clone();
    router.put(r"^/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)$", move |req, res, caps| {
        debug_breakpoint_put(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.delete(r"^/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)$", move |req, res, caps| {
        debug_breakpoint_delete(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.post(r"^/api/v1/debug/([0-9]*)/execute$", move |req, res, caps| {
        debug_execute(req, res, caps, child.clone());
    });

    router.put(r"^/api/v1/debug/([0-9]*)/functions/([0-9]*)/execute$", debug_function_execute);
    
    // executions

    router.get(r"^/api/v1/debug/([0-9]*)/executions$", debug_executions);
    router.get(r"^/api/v1/debug/([0-9]*)/executions/([0-9]*)$", debug_execution);

    let child = child_thread.clone();
    router.get(r"^/api/v1/debug/([0-9]*)/executions/([0-9]*)/trace$", move |req, res, caps| {
        debug_execution_trace(req, res, caps, child.clone());
    });

    router.post(r"^/api/v1/debug/([0-9]*)/executions/([0-9]*)/stop$", debug_execution_stop);

    router.options(r"^.*$", move |_, mut res, _| {
        {
            use hyper::header::*;
            use hyper::method::Method;
            use unicase::UniCase;

            let headers = res.headers_mut();
            headers.set(AccessControlAllowOrigin::Any);
            headers.set(AccessControlAllowMethods(vec![
                Method::Get, Method::Post, Method::Put, Method::Delete
            ]));
            headers.set(AccessControlAllowHeaders(vec![
                UniCase("Content-Type".to_owned())
            ]));
            headers.set(AccessControlMaxAge(10 * 60));
        }

        res.send(b"").unwrap();
    });

    router.finalize().unwrap();

    let server = Server::http("127.0.0.1:3000").unwrap();
    server.handle(router).unwrap();
}

fn send(mut res: Response, body: &[u8]) -> io::Result<()> {
    {
        use hyper::header::*;

        let headers = res.headers_mut();
        headers.set(AccessControlAllowOrigin::Any);
        headers.set(ContentType("application/json".parse().unwrap()));
    }

    res.send(body)
}

/// GET /filesystem/:path* -- gets the file(s) within the given path
fn filesystem(mut req: Request, res: Response, caps: Captures) {
    let caps = caps.unwrap();
    let path = Path::new(&caps[1]);
    io::copy(&mut req, &mut io::sink()).unwrap();

    let meta = fs::metadata(path).unwrap();

    let (file_type, contents) = if meta.is_dir() {
        let entries = fs::read_dir(path).unwrap();
        let contents: Vec<_> = entries.map(|entry| {
            let entry = entry.unwrap();
            let child_file_type = if entry.file_type().unwrap().is_dir() {
                "dir"
            } else {
                "file"
            };

            File {
                name: entry.file_name().into_string().unwrap(),
                path: entry.path().into_os_string().into_string().unwrap(),
                f_type: child_file_type.to_string(),
                contents: vec![],
            }
        }).collect();

        ("dir", contents)
    } else {
        ("file", vec![])
    };

    let name = path.file_name().unwrap().to_string_lossy();
    let path = path.to_string_lossy();

    let my_file = File {
        name: name.to_string(), path: path.to_string(),
        f_type: file_type.to_string(), contents
    };

    let json = serde_json::to_vec(&my_file).unwrap();
    send(res, &json).unwrap();
}

/// GET /processes -- gets the list of processes running on the host machine
fn process(mut req: Request, res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    let curr_procs = read_proc_dir();

    let json = serde_json::to_vec(&curr_procs).unwrap();
    send(res, &json).unwrap();
}

/// helper function to recursively go through /proc directory
fn read_proc_dir() -> Vec<Process> {
    println!("in read_proc_dir");
    let mut processes = Vec::<Process>::new();
    let paths = fs::read_dir("/proc").unwrap();

    for path in paths {
        let dir_entry = path.unwrap();
        let f_name = dir_entry.file_name().into_string().unwrap();
        let mut path_name = dir_entry.path().into_os_string().into_string().unwrap();

        if dir_entry.metadata().unwrap().is_dir()
            && !f_name.parse::<i32>().is_err() {

                path_name.push_str("/status");
                println!("stat path is: {}", f_name);// debug line
                let proc_stats = fs::File::open(path_name).unwrap();
                let reader = io::BufReader::new(proc_stats);

                let mut p_name = "".to_string();
                let mut p_id = "".to_string();

                for line in reader.lines() {
                    let l = line.unwrap();
                    if l.starts_with("Name:") {
                        p_name = l.split("Name:").nth(1).unwrap().trim().to_string();
                    } else if l.starts_with("Pid") {
                        p_id = l.split("Pid:").nth(1).unwrap().trim().to_string();
                    }

                    if !p_name.is_empty() && !p_id.is_empty() {
                        processes.push(Process {
                            id: p_id.parse::<i32>().unwrap(), name: p_name.to_string()
                        });
                        break;
                    }


                } // end reading lines of status file                
            }
    } //end iteration over dirs in proc

    //return processes
    processes
}

/// POST /debug/attach/pid/:pid -- attach to a running process
fn debug_attach_pid(mut req: Request, mut res: Response, caps: Captures, _child: ChildThread) {
    let caps = caps.unwrap();
    let _pid = caps[1].parse::<u64>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// POST /debug/attach/bin/:path -- attach to a binary
fn debug_attach_bin(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let path = PathBuf::from(&caps[1]);
    io::copy(&mut req, &mut io::sink()).unwrap();

    let attached_process = caps[1].clone();

    let mut child = child.lock().unwrap();
    if let Some(child) = child.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();
    }
    *child = Some(child::Thread::launch(path));

    let child = child.as_mut().unwrap();

    let json = match child.rx.recv() {
        Ok(DebugMessage::Attached) => {
            let message = DebugInfo {
                id: 0,
                attached_process: Process {
                    id: 0,
                    name: attached_process.clone(),
                },
                source_path: attached_process,
            };

            serde_json::to_vec(&message).unwrap()
        }

        Ok(DebugMessage::Error(_)) | _ => {
            *res.status_mut() = StatusCode::NotFound;
            let message = Error {
                code: 0, message: format!("binary {} not found", attached_process), data: 0
            };

            serde_json::to_vec(&message).unwrap()
        }
    };
    send(res, &json).unwrap();
}

/// GET /debug
fn debug(mut req: Request, mut res: Response, _: Captures, _child: ChildThread) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// GET /debug/:id/functions -- return a list of debuggable functions
fn debug_functions(mut req: Request, res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    let functions = vec![hardcoded_function()];

    let json = serde_json::to_vec(&functions).unwrap();
    send(res, &json).unwrap();
}

fn hardcoded_function() -> Function {
    Function {
        address: 0x00007ff704051790usize,
        name: String::from("binarySearch"),
        source_path: String::from("binary-search.c"),
        line_number: 15,
        line_count: 19,
        parameters: vec![
            Variable {
                id: 0, name: String::from("key"), s_type: String::from("int"), address: 12345,
            },
            Variable {
                id: 1, name: String::from("array"), s_type: String::from("int*"), address: 12346,
            },
            Variable {
                id: 2, name: String::from("length"), s_type: String::from("int"), address: 12347,
            },
        ],
        local_variables: vec![
            Variable {
                id: 3, name: String::from("low"), s_type: String::from("int"), address: 12348,
            },
            Variable {
                id: 4, name: String::from("high"), s_type: String::from("int"), address: 12349,
            },
            Variable {
                id: 5, name: String::from("mid"), s_type: String::from("int"), address: 12340,
            },
            Variable {
                id: 6, name: String::from("value"), s_type: String::from("int"), address: 12341,
            },
        ],
    }
}

/// GET /debug/:id/functions/:function
fn debug_function(mut req: Request, res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    let message = hardcoded_function();

    let json = serde_json::to_vec(&message).unwrap();
    send(res, &json).unwrap();
}

/// GET /debug/:id/breakpoints
fn debug_breakpoints(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// PUT /debug/:id/breakpoints/:function
fn debug_breakpoint_put(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = child.as_mut().unwrap();

    child.tx.send(ServerMessage::SetBreakpoint { address }).unwrap();
    let json = match child.rx.recv().unwrap() {
        DebugMessage::Breakpoint => {
            let message = Breakpoint {
                function: hardcoded_function(),
                metadata: String::new(),
            };

            serde_json::to_vec(&message).unwrap()
        }

        DebugMessage::Error(e) => {
            *res.status_mut() = StatusCode::InternalServerError;
            let message = Error {
                code: 0, message: format!("{}", e), data: 0
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
    };
    send(res, &json).unwrap();
}

/// DELETE /debug/:id/breakpoints/:function
fn debug_breakpoint_delete(mut req: Request, res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = child.as_mut().unwrap();

    child.tx.send(ServerMessage::ClearBreakpoint { address }).unwrap();

    send(res, b"").unwrap();
}

/// POST /debug/:id/execute -- starts or continues process
fn debug_execute(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = child.as_mut().unwrap();

    child.tx.send(ServerMessage::Continue).unwrap();

    let json = match child.rx.recv() {
        Ok(DebugMessage::Executing) => {
            let message = Execution {
                id: 0,
                e_type: String::from("process"),
                status: String::from("executing"),
                execution_time: 0,
                data: ExecutionData { next_execution: 0 },
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => {
            *res.status_mut() = StatusCode::InternalServerError;

            let message = Error {
                code: 0,
                message: String::from("failed to execute process"),
                data: 0,
            };

            serde_json::to_vec(&message).unwrap()
        }
    };
    send(res, &json).unwrap();
}

/// POST /debug/:id/functions/:function/execute
fn debug_function_execute(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// POST /debug/:id/executions
fn debug_executions(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// GET /debug/:id/executions/:execution -- get information about execution status
fn debug_execution(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}

/// GET /debug/:id/executions/:execution/trace -- Get trace data for execution
fn debug_execution_trace(mut req: Request, res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let _id = caps[1].parse::<u64>().unwrap();
    let execution = caps[2].parse::<u64>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    // TODO: this is a hack for the prototype; implement process executions
    if execution == 0 {
        use serde_json::{Value, Map};

        let mut map = Map::new();
        map.insert(String::from("cause"), Value::String(String::from("breakpoint")));
        map.insert(String::from("next_execution"), Value::U64(1));
        let object = Value::Object(map);

        let message = vec![
            Trace { index: 0, t_type: 2, line: 0, data: object },
        ];

        let json = serde_json::to_vec(&message).unwrap();
        send(res, &json).unwrap();
        return;
    }

    let mut child = child.lock().unwrap();
    let child = child.as_mut().unwrap();

    child.tx.send(ServerMessage::Trace).unwrap();

    let mut prev_locals = HashMap::new();

    let mut res = res.start().unwrap();
    res.write_all(b"[\n").unwrap();

    let mut index = 0;
    let mut done = false;
    while !done {
        child.rx.recv().unwrap();

        let message = match child.rx.recv() {
            Ok(DebugMessage::Trace(DebugTrace::Line(line, locals))) => {
                let this_index = index;
                index += 1;

                let mut state = vec![];
                for &(ref name, value) in locals.iter() {
                    if prev_locals.get(name).map(|&prev_value| value != prev_value).unwrap_or(true) {
                        state.push(TraceState { variable: name.clone(), value });
                    }
                }
                prev_locals = locals.into_iter().collect();

                Trace { index: this_index, t_type: 0, line: line, data: state.to_json() }
            }

            Ok(DebugMessage::Trace(DebugTrace::Terminated)) | _ => {
                done = true;

                Trace { index: index, t_type: 2, line: 0, data: Vec::<Trace>::new().to_json() }
            }
        };

        let json = serde_json::to_vec(&message).unwrap();
        res.write_all(&json).unwrap();
        if !done { res.write_all(b",\n").unwrap(); }
        res.flush().unwrap();
    }

    res.write_all(b"]").unwrap();
    res.end().unwrap();
}

/// POST /debug/:id/executions/:execution/stop -- Halts a running execution
fn debug_execution_stop(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}
