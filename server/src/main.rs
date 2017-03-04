extern crate hyper;
extern crate unicase;
extern crate reroute;
extern crate url;
extern crate mime_guess;

extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

extern crate debug;
extern crate winapi;

use std::{io, fs};
use std::sync::{Mutex, Arc};
use std::sync::atomic::{AtomicBool, Ordering};
use std::io::{Write};
use std::path::Path;
use std::ffi::OsStr;
use std::collections::HashMap;
use std::error::Error;

use hyper::status::StatusCode;
use hyper::server::{Server, Request, Response, Streaming};
use reroute::{RouterBuilder, Captures};
use mime_guess::guess_mime_type;

use child::{ServerMessage, DebugMessage, DebugTrace};

mod child;
mod trace;
mod api;

type ChildThread = Arc<Mutex<Option<child::Thread>>>;
type ChildCancel = Arc<Mutex<Option<Cancel>>>;

struct Cancel {
    cancel: debug::Cancel,
    flag: Arc<AtomicBool>,
}

fn main() {
    // current child thread (only one at a time)
    let child_thread = Arc::new(Mutex::new(None));
    let child_cancel = Arc::new(Mutex::new(None));

    let mut router = RouterBuilder::new();

    // host system

    router.get(r"/api/v1/processes", move |req, res, caps| {
        match processes(caps) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    router.get(r"/api/v1/filesystem/(.*)", move |req, res, caps| {
        match filesystem(caps) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    router.get(r"/file/(.*)", file);

    // attaching

    let child = child_thread.clone();
    let cancel = child_cancel.clone();
    router.post(r"/api/v1/debug/attach/pid/([0-9]*)", move |req, res, caps| {
        match debug_attach_pid(caps, child.clone(), cancel.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    let cancel = child_cancel.clone();
    router.post(r"/api/v1/debug/attach/bin/(.*)", move |req, res, caps| {
        match debug_attach_bin(caps, child.clone(), cancel.clone()) {
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
    router.post(r"/api/v1/debug/([0-9]*)/execute", move |mut req, res, caps| {
        let body: api::Launch = match serde_json::from_reader(&mut req) {
            Ok(body) => body,
            Err(e) => {
                send_error(req, res, io::Error::new(io::ErrorKind::InvalidInput, e)).unwrap();
                return
            }
        };

        match debug_execute(caps, body, child.clone()) {
            Ok(body) => send(req, res, &body),
            Err(e) => send_error(req, res, e),
        }.unwrap();
    });

    let child = child_thread.clone();
    router.post(r"/api/v1/debug/([0-9]*)/functions/([0-9]*)/execute", move |mut req, res, caps| {
        let body: api::Call = match serde_json::from_reader(&mut req) {
            Ok(body) => body,
            Err(e) => {
                send_error(req, res, io::Error::new(io::ErrorKind::InvalidInput, e)).unwrap();
                return
            }
        };

        match debug_function_execute(caps, body, child.clone()) {
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
    let cancel = child_cancel.clone();
    router.get(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/trace", move |mut req, mut res, caps| {
        let mut child_thread = child.lock().unwrap();
        if child_thread.is_none() {
            let e = io::Error::from(io::ErrorKind::NotConnected);
            return send_error(req, res, e).unwrap();
        }

        let _ = match debug_execution_trace(caps, child_thread.as_ref().unwrap()) {
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
        let terminated = match trace_stream(&mut res, child_thread.as_mut().unwrap()) {
            Ok(terminated) => terminated,
            Err(e) => {
                let error = api::Error { message: format!("{:?}", e) };
                let data = api::TraceData::Error { error: error };
                let message = api::Trace { index: 0, line: 0, data: data };
                serde_json::to_writer(&mut res, &message).unwrap();

                res.write_all(b"\n]").unwrap();
                false
            }
        };
        res.end().unwrap();

        if terminated {
            let mut child_cancel = cancel.lock().unwrap();

            if let Some(child) = child_thread.take() {
                child.tx.send(ServerMessage::Quit).unwrap();
                child.thread.join().unwrap();

                child_cancel.take().unwrap();
            }
        }
    });

    let cancel = child_cancel.clone();
    router.post(r"/api/v1/debug/([0-9]*)/executions/([0-9]*)/stop", move |req, res, caps| {
        match debug_execution_stop(caps, cancel.clone()) {
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

    let message = api::Error { message: error.description().into() };
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

/// GET /processes -- gets the list of processes running on the host machine
fn processes(_: Captures) -> io::Result<Vec<u8>> {
    let procs: Vec<_> = debug::Process::running()?
        .map(|debug::Process { id, name }| api::Process {
            id: id,
            name: name.to_string_lossy().into()
        })
        .collect();

    Ok(serde_json::to_vec(&procs).unwrap())
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

    let name = path.file_name().unwrap_or(OsStr::new(""));

    let data = if path.is_dir() {
        let mut contents = vec![];
        for entry in fs::read_dir(path)? {
            let entry = entry?;

            let path = entry.path();
            let name = path.file_name().unwrap_or(OsStr::new(""));
            let data = if path.is_dir() {
                api::FileData::Directory { contents: None }
            } else {
                api::FileData::File
            };

            contents.push(api::File {
                name: name.to_string_lossy().into(),
                path: path.to_string_lossy().into(),
                data: data,
            });
        }

        api::FileData::Directory { contents: Some(contents) }
    } else {
        api::FileData::File
    };

    let message = api::File {
        name: name.to_string_lossy().into(),
        path: path.to_string_lossy().into(),
        data: data,
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /file/:path*
fn file(mut req: Request, mut res: Response, caps: Captures) {
    let caps = caps.unwrap();
    let path = url::percent_encoding::percent_decode(caps[1].as_bytes());
    let path = path.decode_utf8_lossy().into_owned();
    let path = Path::new(&path);

    io::copy(&mut req, &mut io::sink()).unwrap();

    {
        use hyper::header::*;

        let headers = res.headers_mut();
        headers.set(AccessControlAllowOrigin::Any);
        headers.set(ContentType("application/json".parse().unwrap()));
    }

    let mime = guess_mime_type(path);
    match fs::File::open(path) {
        Ok(mut file) => {
            use hyper::header::*;
            res.headers_mut().set(ContentType(mime));

            let mut res = res.start().unwrap();
            io::copy(&mut file, &mut res).unwrap();
            res.end().unwrap();
        }

        Err(e) => {
            *res.status_mut() = status_from_error(e.kind());
        }
    }
}

/// POST /debug/attach/pid/:pid -- attach to a running process
fn debug_attach_pid(caps: Captures, child: ChildThread, cancel: ChildCancel) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let pid = caps[1].parse::<u32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let mut child_thread = child.lock().unwrap();
    let mut child_cancel = cancel.lock().unwrap();
    if let Some(child) = child_thread.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();

        child_cancel.take().unwrap();
    }

    let (child, flag) = child::Thread::attach(pid);
    match child.rx.recv().unwrap() {
        DebugMessage::Attached(cancel) => {
            *child_thread = Some(child);
            *child_cancel = Some(Cancel { cancel, flag });
        }

        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    }

    // TODO: get process name
    let message = api::DebugInfo {
        id: 0,
        attached_process: api::Process {
            id: pid,
            name: String::new(),
        },
    };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// POST /debug/attach/bin/:path -- attach to a binary
fn debug_attach_bin(caps: Captures, child: ChildThread, cancel: ChildCancel) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let path = url::percent_encoding::percent_decode(caps[1].as_bytes());
    let path = path.decode_utf8_lossy().into_owned();
    let path = Path::new(&path);

    let mut child_thread = child.lock().unwrap();
    let mut child_cancel = cancel.lock().unwrap();
    if let Some(child) = child_thread.take() {
        child.tx.send(ServerMessage::Quit).unwrap();
        child.thread.join().unwrap();

        child_cancel.take().unwrap();
    }

    let (child, flag) = child::Thread::launch(path.into());
    match child.rx.recv().unwrap() {
        DebugMessage::Attached(cancel) => {
            *child_thread = Some(child);
            *child_cancel = Some(Cancel { cancel, flag });
        }

        DebugMessage::Error(e) => return Err(e),
        _ => unreachable!(),
    }

    let name = path.file_name().unwrap_or(OsStr::new(""));
    let message = api::DebugInfo {
        id: 0,
        attached_process: api::Process {
            id: 0,
            name: name.to_string_lossy().into(),
        },
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

    let message: Vec<_> = functions.into_iter().map(api::Function::from).collect();
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

    let message = api::Function::from(function);
    Ok(serde_json::to_vec(&message).unwrap())
}

impl From<child::Function> for api::Function {
    fn from(function: child::Function) -> api::Function {
        let child::Function {
            address, name, source_path, line_start, line_count,
            parameters, locals
        } = function;

        let parameters = parameters.into_iter().map(|(name, _address)| api::Variable {
            name: name.to_string_lossy().into(),
            source_type: String::from("int"),
        }).collect();

        let locals = locals.into_iter().map(|(name, _address)| api::Variable {
            name: name.to_string_lossy().into(),
            source_type: String::from("int"),
        }).collect();

        api::Function {
            address,
            name: name.to_string_lossy().into(),
            source_path: source_path.to_string_lossy().into(),
            line_start: line_start,
            line_count: line_count,
            parameters,
            locals,
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
        .map(|address| api::Breakpoint { function: address })
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

    let message = api::Breakpoint { function: address };
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

/// POST /debug/:id/execute
fn debug_execute(caps: Captures, _body: api::Launch, child: ChildThread) -> io::Result<Vec<u8>> {
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
    child.execution = Some((id, child::Execution::Process));

    let message = api::Execution { id: id, data: api::ExecutionData::Process };
    Ok(serde_json::to_vec(&message).unwrap())
}

/// POST /debug/:id/functions/:function/execute
fn debug_function_execute(caps: Captures, body: api::Call, child: ChildThread) -> io::Result<Vec<u8>> {
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
    child.execution = Some((id, child::Execution::Function(address)));

    let data = api::ExecutionData::Function { function: address };
    let message = api::Execution { id: id, data: data };
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

    let message: Vec<_> = child.execution.iter()
        .map(|&(id, ref execution)| {
            let data = api::ExecutionData::from(execution);
            api::Execution { id: id, data: data }
        })
        .collect();
    Ok(serde_json::to_vec(&message).unwrap())
}

/// GET /debug/:id/executions/:execution
fn debug_execution(caps: Captures, child: ChildThread) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let execution_id = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let mut child = child.lock().unwrap();
    let child = child.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    let (id, execution) = match child.execution {
        Some((id, ref execution)) if id == execution_id => (id, execution),
        _ => return Err(io::Error::new(io::ErrorKind::NotFound, "no such execution")),
    };

    let data = api::ExecutionData::from(execution);
    let message = api::Execution { id: id, data: data };
    Ok(serde_json::to_vec(&message).unwrap())
}

impl<'a> From<&'a child::Execution> for api::ExecutionData {
    fn from(execution: &child::Execution) -> api::ExecutionData {
        match *execution {
            child::Execution::Process => api::ExecutionData::Process,
            child::Execution::Function(address) =>
                api::ExecutionData::Function { function: address },
        }
    }
}

/// GET /debug/:id/executions/:execution/trace
fn debug_execution_trace(caps: Captures, child: &child::Thread) -> io::Result<i32> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let execution = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    match child.execution {
        Some((id, _)) if id == execution => Ok(id),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, "no such execution")),
    }
}

fn trace_stream(res: &mut Response<Streaming>, child: &mut child::Thread) -> io::Result<bool> {
    child.tx.send(ServerMessage::Trace).unwrap();

    res.write_all(b"[\n")?;

    let mut next_index = 0;
    let mut prev_locals = HashMap::new();

    let mut terminated = false;
    let mut stack: usize = 0;
    let mut done = false;
    while !done {
        let message = match child.rx.recv().unwrap() {
            DebugMessage::Trace(DebugTrace::Line(line, locals)) => {
                let index = next_index;
                next_index += 1;

                let mut state = vec![];
                for &(ref name, ref value) in locals.iter() {
                    let prev_value = prev_locals.get(name);
                    if prev_value.map(|prev_value| value != prev_value).unwrap_or(true) {
                        state.push(api::TraceState {
                            variable: name.clone(),
                            value: value.clone()
                        });
                    }
                }
                prev_locals.extend(locals.into_iter());

                let data = api::TraceData::Line { state };
                api::Trace { index, line, data }
            }

            DebugMessage::Trace(DebugTrace::Call(line, function)) => {
                let index = next_index;
                next_index += 1;

                stack += 1;

                let data = api::TraceData::Call { function };
                api::Trace { index, line, data }
            }

            DebugMessage::Trace(DebugTrace::Return(line, value)) => {
                let index = next_index;
                next_index += 1;

                stack -= 1;
                if stack == 0 {
                    done = true;
                    child.execution = None;
                }

                let data = api::TraceData::Return { value };
                api::Trace { index, line, data }
            }

            DebugMessage::Trace(DebugTrace::Breakpoint(address)) => {
                done = true;

                let id = child.next_id();
                child.execution = Some((id, child::Execution::Function(address)));

                let data = api::TraceData::Break { next_execution: id };
                api::Trace { index: next_index, line: 0, data }
            }

            DebugMessage::Trace(DebugTrace::Exit(code)) => {
                terminated = true;
                done = true;
                child.execution = None;

                let data = api::TraceData::Exit { code: code };
                api::Trace { index: next_index, line: 0, data }
            }

            DebugMessage::Trace(DebugTrace::Cancel) => {
                done = true;
                child.execution = None;

                let data = api::TraceData::Cancel;
                api::Trace { index: next_index, line: 0, data }
            }

            DebugMessage::Trace(DebugTrace::Crash(stack)) => {
                terminated = true;
                done = true;
                child.execution = None;

                let data = api::TraceData::Crash { stack };
                api::Trace { index: next_index, line: 0, data }
            }

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
    Ok(terminated)
}

/// POST /debug/:id/executions/:execution/stop -- Halts a running execution
fn debug_execution_stop(caps: Captures, cancel: ChildCancel) -> io::Result<Vec<u8>> {
    let caps = caps.unwrap();
    let _debug_id = caps[1].parse::<u64>()
        .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e))?;
    let _execution_id = caps[2].parse::<i32>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    let mut cancel = cancel.lock().unwrap();
    let cancel = cancel.as_mut()
        .ok_or(io::Error::from(io::ErrorKind::NotConnected))?;

    cancel.flag.store(true, Ordering::Relaxed);
    cancel.cancel.trigger_breakpoint()?;

    Ok(vec![])
}
