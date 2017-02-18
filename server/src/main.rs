#![feature(field_init_shorthand)]

extern crate hyper;
extern crate unicase;
extern crate reroute;
extern crate url;
extern crate mime_guess;

extern crate serde;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate serde_json;

extern crate debug;
extern crate winapi;

use std::{io, fs};
use std::sync::{Mutex, Arc};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::io::{Write};
use std::path::Path;
use std::ffi::OsStr;
use std::collections::HashMap;
use std::error::Error;

use hyper::status::StatusCode;
use hyper::server::{Server, Request, Response, Streaming};
use reroute::{RouterBuilder, Captures};
use mime_guess::guess_mime_type;

use serde_json::value::ToJson;

use child::{ServerMessage, DebugMessage, DebugTrace, ExecutionType};
use api::*;

mod child;
mod trace;
mod api;

type ChildThread = Arc<Mutex<Option<child::Thread>>>;

fn main() {
    // current child thread (only one at a time)
    let child_thread = Arc::new(Mutex::new(None));

    // (kill_flag, id of current execution)
    let kill_flag = Arc::new((AtomicBool::new(false), AtomicIsize::new(-1))); 

    let mut router = RouterBuilder::new();

    // host system info

    router.get(r"/file/(.*)", file);

    router.get(r"/api/v1/filesystem/(.*)", move |req, res, caps| {
        match filesystem(caps) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    router.get(r"/api/v1/processes", move |req, res, caps| {
        match processes(caps) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    // attaching

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/attach/pid/([0-9]*)", move |req, res, caps| {
        match debug_attach_pid(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/attach/bin/(.*)", move |req, res, caps| {
        match debug_attach_bin(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug", move |req, res, caps| {
        debug(req, res, caps, child.clone());
    });

    // functions

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/functions", move |req, res, caps| {
        match debug_functions(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/functions/(.*)", move |req, res, caps| {
        match debug_function(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    // breakpoints

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/breakpoints", move |req, res, caps| {
        match debug_breakpoints(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.put(r"/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)", move |req, res, caps| {
        match debug_breakpoint_put(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.delete(r"/api/v1/debug/([0-9]*)/breakpoints/([0-9]*)", move |req, res, caps| {
        match debug_breakpoint_delete(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    // executions
    
    let child = child_thread.clone();
    let kill = kill_flag.clone();
    router.post(r"/api/v1/debug/([0-9]*)/execute", move |mut req, res, caps| {
        let body: Launch = match serde_json::from_reader(&mut req) {
            Ok(body) => body,
            Err(e) => {
                send_error(req, res, io::Error::new(io::ErrorKind::InvalidInput, e)).unwrap();
                return
            }
        };

        match debug_execute(caps, body, child.clone(), kill.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    let kill = kill_flag.clone();
    router.post(r"/api/v1/debug/([0-9]*)/functions/([0-9]*)/execute", move |mut req, res, caps| {
        let body: Call = match serde_json::from_reader(&mut req) {
            Ok(body) => body,
            Err(e) => {
                send_error(req, res, io::Error::new(io::ErrorKind::InvalidInput, e)).unwrap();
                return
            }
        };

        match debug_function_execute(caps, body, child.clone(), kill.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/executions", move |req, res, caps| {
        match debug_executions(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.get(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)", move |req, res, caps| {
        match debug_execution(caps, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    let kill = kill_flag.clone();
    router.get(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/trace", move |mut req, mut res, caps| {
        let _ = match debug_execution_trace(caps, child.clone()) {
            Ok(execution) => execution,
            Err(e) => return send_error(req, res, e).unwrap(),
        };

        io::copy(&mut req, &mut io::sink()).unwrap();

        {
            use hyper::header::*;

            let headers = res.headers_mut();
            headers.set(AccessControlAllowOrigin::Any);
            headers.set(ContentType("application/json".parse().unwrap()));
        }

        let mut res = res.start().unwrap();
        let terminated = match trace_stream(&mut res, child.clone(), kill.clone()) {
            Ok(terminated) => terminated,
            Err(e) => {
                let data = json!({ "cause": "error", "error": format!("{:?}", e) });
                let message = Trace { index: 0, t_type: 2, line: 0, data: data };
                serde_json::to_writer(&mut res, &message).unwrap();

                res.write_all(b"\n]").unwrap();
                false
            }
        };
        res.end().unwrap();

        if terminated {
            let mut child_thread = child.lock().unwrap();
            if let Some(child) = child_thread.take() {
                child.tx.send(ServerMessage::Quit).unwrap();
                child.thread.join().unwrap();
            }
        }
    });

    let child = child_thread.clone();
    let kill = kill_flag.clone();
    router.post(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/stop", move |req, res, caps| {
        match debug_execution_stop(caps, child.clone()) {
            Ok(body) => {
                let mut child_thread = child.lock().unwrap();
                kill.1.store(-1, Ordering::Relaxed);
                if let Some(child) = child_thread.take() {
                    child.thread.join().unwrap();
                }
                send(req, res, &body)
            },
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let kill = kill_flag.clone();
    router.post(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/trace/stop", move |req, res, caps| {
        match debug_trace_stop(caps, kill.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });



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
    println!("Server running on 127.0.0.1:3000");
    server.handle(router).unwrap();
}

fn send(mut req: Request, mut res: Response, body: &[u8]) -> io::Result<()> {
    io::copy(&mut req, &mut io::sink()).unwrap();

    {
        use hyper::header::*;

        let headers = res.headers_mut();
        headers.set(AccessControlAllowOrigin::Any);
        headers.set(ContentType("application/json".parse().unwrap()));
    }

    res.send(body)
}

fn send_error(req: Request, mut res: Response, error: io::Error) -> io::Result<()> {
    *res.status_mut() = status_from_error(error.kind());

    let message = api::Error { code: 0, message: error.description().into(), data: 0 };
    send(req, res, &serde_json::to_vec(&message).unwrap())
}

fn status_from_error(error: io::ErrorKind) -> StatusCode {
    match error {
        io::ErrorKind::NotFound => StatusCode::NotFound,
        io::ErrorKind::NotConnected => StatusCode::Conflict,
        io::ErrorKind::AlreadyExists => StatusCode::PreconditionFailed,
        io::ErrorKind::InvalidInput => StatusCode::BadRequest,
        io::ErrorKind::InvalidData => StatusCode::BadRequest,
        _ => StatusCode::InternalServerError,
    }
}

/// GET /file/:path*
fn file(mut req: Request, mut res: Response, caps: Captures) {
    let caps = caps.unwrap();
    let path = url::percent_encoding::percent_decode(caps[1].as_bytes());
    let path = path.decode_utf8_lossy().into_owned();
    let path = Path::new(&path);

    io::copy(&mut req, &mut io::sink()).unwrap();

    let mime = guess_mime_type(path);
    match fs::File::open(path) {
        Ok(mut file) => {
            {
                use hyper::header::*;

                let headers = res.headers_mut();
                headers.set(ContentType(mime));
                headers.set(AccessControlAllowOrigin::Any);
                headers.set(ContentType("application/json".parse().unwrap()));
            }

            let mut res = res.start().unwrap();
            io::copy(&mut file, &mut res).unwrap();
            res.end().unwrap();
        }

        Err(e) => {
            *res.status_mut() = status_from_error(e.kind());
        }
    }
}

/// GET /filesystem/:path* -- gets the file(s) within the given path
fn filesystem(caps: Captures) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let path = url::percent_encoding::percent_decode(caps[1].as_bytes());
    let path = path.decode_utf8_lossy().into_owned();
    let path = Path::new(&path);
    if !path.exists() {
        return Err(io::Error::from(io::ErrorKind::NotFound));
    }

    let (file_type, contents) = if path.is_dir() {
        let mut contents = vec![];
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();

            let name = path.file_name().unwrap_or(OsStr::new(""));
            let file_type = if path.is_dir() { "dir" } else { "file" };

            contents.push(File {
                name: name.to_string_lossy().into(),
                path: path.to_string_lossy().into(),
                f_type: file_type.into(),
                contents: vec![],
            });
        }

        ("dir", contents)
    } else {
        ("file", vec![])
    };

    let name = path.file_name().unwrap_or(OsStr::new(""));

    let message = File {
        name: name.to_string_lossy().into(),
        path: path.to_string_lossy().into(),
        f_type: file_type.into(),
        contents
    };

    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /processes -- gets the list of processes running on the host machine
fn processes(_: Captures) -> io::Result<Vec<u8>> {
    let procs: Vec<_> = debug::Process::running()?
        .map(|debug::Process { id, name }| Process {
            id: id,
            name: name.to_string_lossy().into()
        })
        .collect();

    Ok(serde_json::to_vec(&procs).unwrap())
}

/// POST /debug/attach/pid/:pid -- attach to a running process
fn debug_attach_pid(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let pid = caps[1].parse::<u32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let mut child_thread = child.lock().unwrap();
    if let Some(child) = child_thread.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();
    }

    let child = child::Thread::attach(pid);
    match child.rx.recv().unwrap() {
        DebugMessage::Attached => *child_thread = Some(child),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };

    let message = DebugInfo {
        id: 0,
        attached_process: Process {
            id: pid,
            name: String::new(),
        },
        source_path: String::new(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// POST /debug/attach/bin/:path -- attach to a binary
fn debug_attach_bin(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let path = url::percent_encoding::percent_decode(caps[1].as_bytes());
    let path = path.decode_utf8_lossy().into_owned();
    let path = Path::new(&path);

    let mut child_thread = child.lock().unwrap();
    if let Some(child) = child_thread.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();
    }

    let child = child::Thread::launch(path.into());
    match child.rx.recv().unwrap() {
        DebugMessage::Attached => *child_thread = Some(child),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };

    let name = path.file_name().unwrap_or(OsStr::new(""));
    let message = DebugInfo {
        id: 0,
        attached_process: Process {
            id: 0,
            name: name.to_string_lossy().into(),
        },
        source_path: path.to_string_lossy().into(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /debug
fn debug(req: Request, mut res: Response, _: Captures, _child: ChildThread) {
    *res.status_mut() = StatusCode::NotImplemented;
    send(req, res, b"").unwrap();
}

/// GET /debug/:id/functions -- return a list of debuggable functions
fn debug_functions(_: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::ListFunctions).unwrap();
    let functions = match child.rx.recv().unwrap() {
        DebugMessage::Functions(functions) => functions,
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };

    let message: Vec<_> = functions.into_iter().map(Function::from).collect();
    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /debug/:id/functions/:function
fn debug_function(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::DescribeFunction { address }).unwrap();
    let function = match child.rx.recv().unwrap() {
        DebugMessage::Function(function) => function,
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!()
    };

    let message = Function::from(function);
    Ok(serde_json::to_vec(&message).unwrap())
}

impl From<child::Function> for Function {
    fn from(function: child::Function) -> Function {
        let child::Function {
            address, name, source_path, line_number, line_count,
            parameters, local_variables
        } = function;

        let parameters = parameters.into_iter().map(|(id, name, address)| Variable {
            id: id,
            name: name.to_string_lossy().into(),
            address: address,
            s_type: String::from("int"),
        }).collect();

        let local_variables = local_variables.into_iter().map(|(id, name, address)| Variable {
            id: id,
            name: name.to_string_lossy().into(),
            address: address,
            s_type: String::from("int"),
        }).collect();

        Function {
            address,
            name: name.to_string_lossy().into(),
            source_path: source_path.to_string_lossy().into(),
            line_number: line_number as i32,
            line_count: line_count as i32,
            parameters,
            local_variables,
        }
    }
}

/// GET /debug/:id/breakpoints
fn debug_breakpoints(_: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::ListBreakpoints).unwrap();
    let breakpoints = match child.rx.recv().unwrap() {
        DebugMessage::Breakpoints(breakpoints) => breakpoints,
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };

    let message: Vec<_> = breakpoints.into_iter()
        .map(|address| Breakpoint {
            function: address,
            metadata: String::new(),
        })
        .collect();
    Ok(serde_json::to_vec(&message).unwrap())
}

/// PUT /debug/:id/breakpoints/:function
fn debug_breakpoint_put(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::SetBreakpoint { address }).unwrap();
    match child.rx.recv().unwrap() {
        DebugMessage::Breakpoint => (),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!()
    };

    let message = Breakpoint {
        function: address,
        metadata: String::new(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// DELETE /debug/:id/breakpoints/:function
fn debug_breakpoint_delete(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let address = caps[2].parse::<usize>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::ClearBreakpoint { address }).unwrap();
    match child.rx.recv().unwrap() {
        DebugMessage::BreakpointRemoved => (),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };

    Ok(vec![])
}

/// POST /debug/:id/execute -- starts or continues process
fn debug_execute(
    caps: Captures, _body: Launch, child: ChildThread, kill: Arc<(AtomicBool, AtomicIsize)>
) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;

    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::Continue).unwrap();
    let id = match child.rx.recv().unwrap() {
        DebugMessage::Executing => child.next_id(),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };
    kill.1.store(id as isize, Ordering::Relaxed);
    child.execution = Some((id, ExecutionType::Process));

    let data = ProcessExecution { next_execution: 0 };
    let message = Execution {
        id: id, 
        e_type: String::from("process"),
        status: String::from("executing"),
        execution_time: 0,
        data: data.to_json().unwrap(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// POST /debug/:id/functions/:function/execute
fn debug_function_execute(
    caps: Captures, body: Call, child: ChildThread,  kill: Arc<(AtomicBool, AtomicIsize)>
) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let address = caps[2].parse::<usize>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;
    let arguments = body.parameters;

    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::CallFunction { address, arguments }).unwrap();
    let id = match child.rx.recv().unwrap() {
        DebugMessage::Executing => child.next_id(),
        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    };
    kill.1.store(id as isize, Ordering::Relaxed);
    child.execution = Some((id, ExecutionType::Function(address)));

    let data = FunctionExecution { function: address };
    let message = Execution {
        id: id,
        e_type: String::from("function"),
        status: String::from("executing"),
        execution_time: 0,
        data: data.to_json().unwrap(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// POST /debug/:id/executions
fn debug_executions(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;

    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    let mut message = vec![];
    for &(id, ref e_type) in &child.execution {
        let (e_type, data) = match *e_type {
            ExecutionType::Function(address) => {
                let data = FunctionExecution { function: address };
                (String::from("function"), data.to_json().unwrap())
            }

            ExecutionType::Process => {
                let data = ProcessExecution { next_execution: 0 };
                (String::from("process"), data.to_json().unwrap())
            }
        };

        message.push(Execution {
            id: id, 
            e_type: e_type,
            status: String::from("executing"),
            execution_time: -1,
            data: data,
        });
    }

    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /debug/:id/executions/:execution -- get information about execution status
fn debug_execution(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;

    let execution_id = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;


    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    let (id, e_type) = match child.execution {
        Some((id, ref e_type)) if id == execution_id => (id, e_type),
        _ => return Err(io::Error::new(io::ErrorKind::NotFound, "no such execution")),
    };

    let (e_type, data) = match *e_type {
        ExecutionType::Function(address) => {
            let data = FunctionExecution { function: address };
            (String::from("function"), data.to_json().unwrap())
        }

        ExecutionType::Process => {
            let data = ProcessExecution { next_execution: 0 };
            (String::from("process"), data.to_json().unwrap())
        }
    };

    let message = Execution {
        id: id,
        e_type: e_type,
        status: String::from("executing"),
        execution_time: -1,
        data: data.to_json().unwrap(),
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /debug/:id/executions/:execution/trace -- Get trace data for execution
fn debug_execution_trace(caps: Captures, child: ChildThread) -> io::Result<i32> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let execution = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    match child.execution {
        Some((id, _)) if id == execution => Ok(id),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, "no such execution")),
    }
}

/// POST /debug/:id/executions/:execution/trace/stop
fn debug_trace_stop(caps: Captures, kill: Arc<(AtomicBool, AtomicIsize)>) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let execution_id = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    if execution_id as isize != kill.1.load(Ordering::Relaxed) {
        return Err(io::Error::new(io::ErrorKind::NotFound, "not currently executing"));
    }
    
    kill.0.store(true, Ordering::Relaxed);

    let data = ProcessExecution { next_execution: 0 };
    let message = Execution {
        id: 1,
        e_type: String::from("function"),
        status: String::from("stopped"),
        execution_time: -1,
        data: data.to_json().unwrap(),
    };
    
    Ok(serde_json::to_vec(&message).unwrap())
}

fn trace_stream(
    res: &mut Response<Streaming>, child: ChildThread, kill: Arc<(AtomicBool, AtomicIsize)>
) -> io::Result<bool> {
    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    child.tx.send(ServerMessage::Trace).unwrap();

    res.write_all(b"[\n")?;

    let mut index = 0;
    let mut prev_locals = HashMap::new();

    let mut terminated = false;
    let mut done = false;
    while !done {
        match kill.0.load(Ordering::Relaxed) {
            true => {
                println!("kill value is true");
                println!("Sending stop message to debug loop");
                child.tx.send(ServerMessage::Stop).unwrap();   
            },
            false => {
                println!("kill value is false");
                child.tx.send(ServerMessage::Continue).unwrap();   
            }
        };
        let message = match child.rx.recv().unwrap() {
            DebugMessage::Trace(DebugTrace::Line(line, locals)) => {
                println!("debug trace line");
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

                let data = json!(TraceData { state: state });
                Trace { index: this_index, t_type: 0, line: line, data: data }
            }

            DebugMessage::Trace(DebugTrace::Return(line, value)) => {
                println!("debug trace stop return");
                done = true;
                child.execution = None;

                let data = json!({ "cause": "return", "returnValue": value });
                Trace { index: index, t_type: 2, line: line, data: data }
            }

            DebugMessage::Trace(DebugTrace::Breakpoint(address)) => {
                done = true;
                println!("debug trace breakpoint");
                let id = child.next_id();
                child.execution = Some((id, ExecutionType::Function(address)));

                let data = json!({ "cause": "breakpoint", "nextExecution": id });
                Trace { index: 0, t_type: 2, line: 0, data: data }
            }

            DebugMessage::Trace(DebugTrace::Exit(code)) => {
                println!("debug trace exit");
                terminated = true;
                done = true;
                child.execution = None;

                let data = json!({ "cause": "exit", "returnCode": code });
                Trace { index: 0, t_type: 2, line: 0, data: data }
            }

            DebugMessage::Trace(DebugTrace::Crash) => {
                println!("debug trace crash");
                terminated = true;
                done = true;
                child.execution = None;

                let data = json!({ "cause": "crash" });
                Trace { index: 0, t_type: 2, line: 0, data: data }
            }

            DebugMessage::Trace(DebugTrace::StopRequest) => {
                println!("debug trace stop request");
                done = true;
                child.execution = None;
                kill.0.store(false, Ordering::Relaxed);
                kill.1.store(-1, Ordering::Relaxed);

                let data = json!({ "cause": "stop request" });
                Trace { index: 0, t_type: 2, line: 0, data: data }
            }

            DebugMessage::Trace(DebugTrace::Running) => {continue;}

            DebugMessage::Error(e) => {
                child.execution = None;
                return Err(e);
            }
            _ => unreachable!(),
        };

        serde_json::to_writer(res, &message).unwrap();
        if !done { res.write_all(b",\n")?; }
        res.flush()?;
    }

    res.write_all(b"\n]")?;
    println!("leaving trace stream");
    Ok(terminated)
}
    
// Stops the execution and terminates the process.  User has to start over
/// POST /debug/:id/executions/:execution/stop -- Halts a running execution
fn debug_execution_stop(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let execution_id = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let child = child.lock().unwrap();
    let child = child.as_ref()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    let (id, e_type) = match child.execution {
        Some((id, ref e_type)) if id == execution_id => (id, e_type),
        _ => return Err(io::Error::new(io::ErrorKind::NotFound, "no such execution")),
    };

    child.tx.send(ServerMessage::Quit).unwrap();

    match child.rx.recv().unwrap() {
        DebugMessage::Error(e) => return Err(e),
        _ => {},
    };

    let (e_type, data) = match *e_type {
        ExecutionType::Function(address) => {
            let data = FunctionExecution { function: address };
            (String::from("function"), data.to_json().unwrap())
        }

        ExecutionType::Process => {
            let data = ProcessExecution { next_execution: 0 };
            (String::from("process"), data.to_json().unwrap())
        }
    };

    let message = Execution {
        id: id,
        e_type: e_type,
        status: String::from("stopped"),
        execution_time: -1,
        data: data.to_json().unwrap(),
    };

    Ok(serde_json::to_vec(&message).unwrap())
}
