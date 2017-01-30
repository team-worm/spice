#![feature(custom_derive, field_init_shorthand)]

extern crate hyper;
extern crate unicase;
extern crate reroute;

#[macro_use]
extern crate serde_derive;

extern crate serde;
extern crate serde_json;

extern crate debug;
extern crate winapi;

use std::{io, fs};
use std::sync::{Mutex, Arc};
use std::io::{Write};
use std::path::{PathBuf, Path};
use std::collections::HashMap;
use std::error::Error;

use hyper::status::StatusCode;
use hyper::server::{Server, Request, Response};
use reroute::{RouterBuilder, Captures};

use serde_types::*;
use serde_json::value::ToJson;
use child::{ServerMessage, DebugMessage, DebugTrace};

mod serde_types;
mod child;

type ChildThread = Arc<Mutex<Option<child::Thread>>>;

fn main() {
    // current child thread (only one at a time)
    let child_thread = Arc::new(Mutex::new(None));

    let mut router = RouterBuilder::new();

    // host system info

    router.get(r"/api/v1/filesystem/(.*)", filesystem);
    router.get(r"/api/v1/processes", processes);

    // attaching

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/attach/pid/([0-9]*)", move |req, res, caps| {
        debug_attach_pid(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/attach/bin/(.*)", move |req, res, caps| {
        debug_attach_bin(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug", move |req, res, caps| {
        debug(req, res, caps, child.clone());
    });

    // functions

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/functions", move |req, res, caps| {
        debug_functions(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/functions/(.*)", move |req, res, caps| {
        debug_function(req, res, caps, child.clone());
    });

    // breakpoints

    router.get(r"/api/v1/debug/([0-9]*)/breakpoints", debug_breakpoints);

    let child = child_thread.clone();
    router.put(r"/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)", move |req, res, caps| {
        debug_breakpoint_put(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.delete(r"/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)", move |req, res, caps| {
        debug_breakpoint_delete(req, res, caps, child.clone());
    });

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/([0-9]*)/execute", move |req, res, caps| {
        debug_execute(req, res, caps, child.clone());
    });

    router.put(r"/api/v1/debug/([0-9]*)/functions/([0-9]*)/execute", debug_function_execute);
    
    // executions

    router.get(r"/api/v1/debug/([0-9]*)/executions", debug_executions);
    router.get(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)", debug_execution);

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/trace", move |req, res, caps| {
        debug_execution_trace(req, res, caps, child.clone());
    });

    router.post(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/stop", debug_execution_stop);

    router.options(r".*", move |_, mut res, _| {
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

    let router = router.finalize().unwrap();

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
fn filesystem(mut req: Request, mut res: Response, caps: Captures) {
    let caps = caps.unwrap();
    let path = Path::new(&caps[1]);
    io::copy(&mut req, &mut io::sink()).unwrap();

    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(err) => {
            let message = serde_types::Error{
                code: -1,
                message: format!("Error getting metadata for file"),
                err_data: format!("{}", err.description())
            };
            *res.status_mut() = StatusCode::NotFound;
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    let (file_type, contents) = if meta.is_dir() {
        let entries = match fs::read_dir(path){
            Ok(iter) => iter,
            Err(err) => {
                let message = serde_types::Error{
                    code: -1,
                    message: format!("Unable to read directory contents"),
                    err_data: format!("{}", err.description())
                };
                *res.status_mut() = StatusCode::NotFound;
                send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
                return;
            },
        };
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
fn processes(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    let procs: Vec<_> = match debug::Process::running() {
        Ok(processes) => processes.map(|debug::Process { id, name }| Process {
            id: id, name: name.to_string_lossy().into_owned()
        }).collect(),

        Err(err) => {
            let message = serde_types::Error{
                code: -1,
                message: format!("Unable to get list of running processes"),
                err_data: format!("{}", err.description())
            };
            
            *res.status_mut() = StatusCode::NotFound;
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    let json = serde_json::to_vec(&procs).unwrap();
    send(res, &json).unwrap();
}

/// POST /debug/attach/pid/:pid -- attach to a running process
fn debug_attach_pid(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let pid = caps[1].parse::<u32>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    if let Some(child) = child.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();
    }
    *child = Some(child::Thread::attach(pid));

    // need to figure out what this will be if the above line errors out
    let child = child.as_mut().unwrap();

    let json = match child.rx.recv() {
        Ok(DebugMessage::Attached) => {
            let message = DebugInfo {
                id: 0,
                attached_process: Process {
                    id: pid,
                    name: String::new(),
                },
                source_path: String::new(),
            };

            serde_json::to_vec(&message).unwrap()
        }

        Ok(DebugMessage::Error(msg, err))  => {
            *res.status_mut() = StatusCode::NotFound;
            let message = serde_types::Error {
                code: 0,
                message: format!("Couldn't attach to pid: {} -- {}", pid, msg),
                err_data: format!("{}", err.description())
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
    };
    send(res, &json).unwrap();
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

        Ok(DebugMessage::Error(msg, err)) => {
            *res.status_mut() = StatusCode::NotFound;
            let message = serde_types::Error {
                code: 0,
                message: format!("Couldn't attach to binary: {} -- {}", attached_process, msg),
                err_data: format!("{}", err.description())
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
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
fn debug_functions(mut req: Request, mut res: Response, _: Captures, child: ChildThread) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = match child.as_mut() {
        Some(t) => t,
        None => {
            let message = serde_types::Error{
                code: -1,
                message: format!("You must attach to a binary or process first"),
                err_data: format!("")
            };

            *res.status_mut() = StatusCode::Forbidden; 
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    child.tx.send(ServerMessage::ListFunctions).unwrap();
    let json = match child.rx.recv().unwrap() {
        DebugMessage::Functions(functions) => {
            let message: Vec<_> = functions.into_iter().map(Function::from).collect();
            serde_json::to_vec(&message).unwrap()
        }

        DebugMessage::Error(msg, e) => {
            *res.status_mut() = StatusCode::InternalServerError;
            let message = serde_types::Error {
                code: 0,
                message: format!("{}", msg),
                err_data: format!("{}", e.description())
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
    };
    send(res, &json).unwrap();
}

/// GET /debug/:id/functions/:function
fn debug_function(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = match child.as_mut() {
        Some(t) => t,
        None => {
            let message = serde_types::Error{
                code: -1,
                message: format!("You must attach to a binary or process first"),
                err_data: format!("")
            };
            
            *res.status_mut() = StatusCode::Forbidden; 
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    child.tx.send(ServerMessage::DescribeFunction { address }).unwrap();
    let json = match child.rx.recv().unwrap() {
        DebugMessage::Function(function) => {
            let message = Function::from(function);
            serde_json::to_vec(&message).unwrap()
        }

        DebugMessage::Error(msg, e) => {
            *res.status_mut() = StatusCode::InternalServerError;
            let message = serde_types::Error {
                code: 0,
                message: format!("{}", msg),
                err_data: format!("{}", e.description())
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
    };
    send(res, &json).unwrap();
}

impl From<child::Function> for Function {
    fn from(function: child::Function) -> Function {
        let child::Function {
            address, name, source_path, line_number, line_count,
            parameters, local_variables: locals
        } = function;

        let parameters = parameters.into_iter().map(|(id, name, address)| Variable {
            id: id, name: name.to_string_lossy().into_owned(), address: address,
            s_type: String::from("int"),
        }).collect();

        let local_variables = locals.into_iter().map(|(id, name, address)| Variable {
            id: id, name: name.to_string_lossy().into_owned(), address: address,
            s_type: String::from("int"),
        }).collect();

        Function {
            address,
            name: name.to_string_lossy().into_owned(),
            source_path: source_path.to_string_lossy().into_owned(),
            line_number: line_number as i32, line_count: line_count as i32,
            parameters, local_variables,
        }
    }
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

    let child = match child.as_mut() {
        Some(t) => t,
        None => {
            let message = serde_types::Error{
                code: -1,
                message: format!("You must attach to a binary or process first"),
                err_data: format!("")
            };
            
            *res.status_mut() = StatusCode::Forbidden; 
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    child.tx.send(ServerMessage::SetBreakpoint { address }).unwrap();
    let json = match child.rx.recv().unwrap() {
        DebugMessage::Breakpoint => {
            let message = Breakpoint {
                function: address,
                metadata: String::new(),
            };

            serde_json::to_vec(&message).unwrap()
        }

        DebugMessage::Error(msg, e) => {
            *res.status_mut() = StatusCode::InternalServerError;
            let message = serde_types::Error {
                code: 0,
                message: format!("{}", msg),
                err_data: format!("{}", e)
            };

            serde_json::to_vec(&message).unwrap()
        }

        _ => unreachable!()
    };
    send(res, &json).unwrap();
}

/// DELETE /debug/:id/breakpoints/:function
fn debug_breakpoint_delete(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = match child.as_mut() {
        Some(t) => t,
        None => {
            let message = serde_types::Error{
                code: -1,
                message: format!("You must attach to a binary or process first"),
                err_data: format!("")
            };
            
            *res.status_mut() = StatusCode::NotFound;
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

    child.tx.send(ServerMessage::ClearBreakpoint { address }).unwrap();

    send(res, b"").unwrap();
}

/// POST /debug/:id/execute -- starts or continues process
fn debug_execute(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut child = child.lock().unwrap();
    let child = match child.as_mut() {
        Some(t) => t,
        None => {
            let message = serde_types::Error{
                code: -1,
                message: format!("You must attach to a binary or process first"),
                err_data: format!("")
            };
            *res.status_mut() = StatusCode::Forbidden; 
            send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
            return;
        },
    };

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

            let message = serde_types::Error {
                code: 0,
                message: format!("failed to execute process"),
                err_data: format!("{}", "")
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
fn debug_execution_trace(mut req: Request, mut res: Response, caps: Captures, child: ChildThread) {
    let caps = caps.unwrap();
    let _id = caps[1].parse::<u64>().unwrap();
    let execution = caps[2].parse::<u64>().unwrap();
    io::copy(&mut req, &mut io::sink()).unwrap();

    let mut error = false;
    let mut child = child.lock().unwrap();
    {    
        let child_t = match child.as_mut() {
            Some(t) => t,
            None => {
                let message = serde_types::Error{
                    code: -1,
                    message: format!("You must attach to a binary or process first"),
                    err_data: format!("")
                };
                *res.status_mut() = StatusCode::Forbidden; 
                send(res, &serde_json::to_vec(&message).unwrap()).unwrap();
                return;
            },
        };


        // TODO: this is a hack for the prototype; implement process executions
        if execution == 0 {
            use serde_json::{Value, Map};

            let mut map = Map::new();
            map.insert(String::from("cause"), Value::String(String::from("breakpoint")));
            map.insert(String::from("nextExecution"), Value::U64(1));
            let object = Value::Object(map);

            let message = vec![
                Trace { index: 0, t_type: 2, line: 0, data: object },
            ];

            let json = serde_json::to_vec(&message).unwrap();
            send(res, &json).unwrap();
            return;
        }

        child_t.tx.send(ServerMessage::Trace).unwrap();
        child_t.rx.recv().unwrap();

        let mut prev_locals = HashMap::new();

        {
            use hyper::header::*;

            let headers = res.headers_mut();
            headers.set(AccessControlAllowOrigin::Any);
            headers.set(ContentType("application/json".parse().unwrap()));
        }

        let mut res = res.start().unwrap();
        res.write_all(b"[\n").unwrap();

        let mut index = 0;
        let mut done = false;

        while !done {
            let message = match child_t.rx.recv() {
                Ok(DebugMessage::Trace(DebugTrace::Line(line, locals))) => {
                    let this_index = index;
                    index += 1;

                    let mut state = vec![];
                    for &(ref name, ref value) in locals.iter() {
                        let prev_value = prev_locals.get(name);
                        if prev_value.map(|prev_value| value != prev_value).unwrap_or(true) {
                            state.push(TraceState { variable: name.clone(), value: value.clone() });
                        }
                    }
                    prev_locals.extend(locals.into_iter());

                    Trace { index: this_index, t_type: 0, line: line, data: state.to_json() }
                }

                Ok(DebugMessage::Trace(DebugTrace::Terminated(line))) => {
                    done = true;

                    Trace { index: index, t_type: 2, line: line, data: Vec::<Trace>::new().to_json() }
                }

                Ok(DebugMessage::Trace(DebugTrace::Error(msg, err, line))) => {
                    done = true;
                    error = true;
                    child_t.tx.send(ServerMessage::Quit).unwrap();
                    
                    Trace { index: index,
                            t_type: 2,
                            line: line,
                            data: format!("{} -- {}", msg, err.description()).to_json()
                    }
                }

                _ => unreachable!()
            };


            let json = serde_json::to_vec(&message).unwrap();
            res.write_all(&json).unwrap();
            if !done { res.write_all(b",\n").unwrap(); }
            res.flush().unwrap();
        }
        res.write_all(b"]").unwrap();
        res.end().unwrap();

    }

    if error {
        *child = None;        
    }
}

/// POST /debug/:id/executions/:execution/stop -- Halts a running execution
fn debug_execution_stop(mut req: Request, mut res: Response, _: Captures) {
    io::copy(&mut req, &mut io::sink()).unwrap();

    *res.status_mut() = StatusCode::NotImplemented;
    send(res, b"").unwrap();
}
