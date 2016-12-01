#![feature(field_init_shorthand)]

extern crate hyper;
extern crate reroute;
extern crate serde;
extern crate serde_json;

extern crate debug;
extern crate winapi;
extern crate kernel32;

use std::{fs, io, mem, ptr};
use std::path::Path;
use std::io::BufRead;
use std::sync::mpsc;
use std::sync::{Mutex, Arc};
use std::collections::HashMap;

use hyper::server::{Server, Request, Response};
use reroute::{Captures, Router};
use std::os::windows::io::AsRawHandle;


use serde_types::*;

mod serde_types {
    #![allow(non_snake_case)]

    include!(concat!(env!("OUT_DIR"), "/serde_types.rs"));
}

/// messages the debug event loop sends to the server
enum DebugMessage {
    AttachInfo(AttachInfo),
    Exec(Execution),
    Err(Error),
}

/// messages the server sends to the debug event loop to request info
enum ServerMessage {
    Launch,
    Execute,
}

//static VERSION : &'static str = "/api/v1/";

//REST ENDPOINTS
static FILE_SYS_END_PT: &'static str = r"/api/v1/filesystem/([[:ascii:]]*)";
static PROCESS_END_PT: &'static str = r"/api/v1/processes$";
static DEBUG_ATCH_PID_END_PT: &'static str = r"/api/v1/debug/attach/pid/([[:digit:]]*)";
static DEBUG_ATCH_BIN_END_PT: &'static str = r"/api/v1/debug/attach/bin/([[:ascii:]]*)";
static DEBUG_END_PT: &'static str = r"/api/v1/debug$";
static DEBUG_FUNC_LST_END_PT: &'static str = r"/api/v1/debug/functions$";
static DEBUG_FUNC_END_PT: &'static str = r"/api/v1/debug/functions/([[:ascii:]]*)";
static BRKPNT_END_PT: &'static str = r"/api/v1/debug/breakpoints$";
static FUNC_BRKPNT_END_PT: &'static str = r"/api/v1/debug/breakpoints/([[:ascii:]]*)";
static DEBUG_EXEC_PROC_END_PT: &'static str = r"/api/v1/debug/([[:digit:]]*)/execute";
static DEBUG_EXEC_FUNC_END_PT: &'static str = r"/api/v1/debug/functions/([[:ascii:]]*)/execute";

static DEBUG_EXEC_LST_END_PT: &'static str = r"/api/v1/debug/executions$";
static DEBUG_EXEC_STATUS_END_PT: &'static str = r"/api/v1/debug/executions/([[:digit:]]*)";
static DEBUG_EXEC_TRACE_END_PT: &'static str = r"/api/v1/debug/executions/([[:digit:]]*)/trace";
static DEBUG_EXEC_STOP_END_PT: &'static str = r"/api/v1/debug/executions/([[:digit:]]*)/stop";

/// @ /greet
fn basic_handler(_: Request, res: Response, _: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /filesystem/:path* -- return a list of files given a directory path
fn filesystem_handler(_: Request, res: Response, c: Captures) {
    println!("in filesystem_handler");

    let caps = c.unwrap();
    let path = Path::new(&caps[1]);

    let file_meta = fs::metadata(path).unwrap();

    let (file_type, contents) = if file_meta.is_dir() {
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
                fType: child_file_type.to_string(),
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
        fType: file_type.to_string(), contents
    };

    let json_str = serde_json::to_string(&my_file).unwrap();

    res.send(&json_str.into_bytes()).unwrap();
}

/// @ /processes -- list the currently running processes on the host machine
/// This assumes running on linux so reads proc dir
/// TODO: get list of running processes for windows
fn process_handler(_: Request, res: Response, _: Captures) {
    println!("in process_handler");

    let curr_procs = read_proc_dir();

    let json_str = serde_json::to_string(&curr_procs).unwrap();
    res.send(&json_str.into_bytes()).unwrap();
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

/// @ /debug/attach/pid/:pid -- attach to currently running process by pid
fn attach_pid_handler(_:Request, res: Response, c: Captures) {
    println!("in attach_pid_handler");

    let caps = c.unwrap();
    let ref pid = caps[1];

    let mut debug_str = "You attached to pid ".to_string();
    debug_str.push_str(&pid);
    res.send(debug_str.as_bytes()).unwrap(); //TODO: attach to process based on pid
}


/// @ /debug/attach/bin/:path -- attach to a binary that resides at :path
/// Attaches to a binary executable and returns the name of the binary if success
/// This will spawn the debug event loop thread if it isn't currently running.
/// All other endpoints will just communicate with the thread to gather info
/// Otherwise returns an Error
/// d_snd = debug thread sending channel
/// serv_rec = servers receiving comm channel
fn attach_bin_handler(
    _req: Request, res: Response, c: Captures,
    d_sndr: Arc<Mutex<mpsc::SyncSender<DebugMessage>>>,
    d_rcvr: Arc<Mutex<mpsc::Receiver<ServerMessage>>>,
    s_rcvr: Arc<Mutex<mpsc::Receiver<DebugMessage>>>,
) {
    let mut caps = c.unwrap();
    let path = mem::replace(&mut caps[1], String::new());

    // need a way to return out of this if we are already running so we don't spawn
    // tons of threads if users call this multiple times
    std::thread::spawn(move || {
        debug_attach_helper(path, d_sndr, d_rcvr);
    });

    // unwrap the arc -> lock the receiver -> unwrap the result ->
    let msg = match s_rcvr.lock().unwrap().recv() {
        Ok(m) => m,
        Err(_) => {
            DebugMessage::Err(Error{code: 411, name: "Comm channel closed".to_string(),
                  message: "There was an error receiving message from debug thread".to_string(),
                  data: 1})
        }
    };

    send_json_msg(msg, res);
}

///This will be called in it's own thread
/// This attachs to a binary and then sits in a debug event loop until the process exits
fn debug_attach_helper(
    path: String, d_sndr: Arc<Mutex<mpsc::SyncSender<DebugMessage>>>,
    d_rcvr: Arc<Mutex<mpsc::Receiver<ServerMessage>>>
) {
    let mut launched = false;
    // It is a success if we get a child object back.
    // This means we have successfully attached.  We don't have a pid yet b/c we aren't
    // executing that process

    let child = match debug::Command::new(&path)
        .env_clear()
        .debug() {
            Ok(c) => {
                d_sndr.lock().unwrap()
                    .send(DebugMessage::AttachInfo(AttachInfo {
                        id: 1, attachedProcess: path
                    }))
                    .expect("failed to send");
                c
            }
            Err(_) => {
                d_sndr.lock().unwrap()
                    .send(DebugMessage::Err(Error {
                        code: 411,
                        name: "Failed to attach".to_string(),
                        message: "Could not attach to binary".to_string(),
                        data: 1
                    }))
                    .expect("failed to send");
                return;
                // do we need to kill the thread??
            }
        };

    
    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let mut symbols = debug::SymbolHandler::initialize(child.as_raw_handle())
        .expect("failed to initialize symbol handler");

    loop {
        let event = debug::DebugEvent::wait_event()
            .expect("failed to get debug event");

        let mut debug_continue = false;

        // wait for the server to tell us what it wants
        match d_rcvr.lock().unwrap().recv().unwrap() {
            ServerMessage::Launch => {
                if launched {
                    d_sndr.lock().unwrap()
                        .send(DebugMessage::Err(Error {
                            code: 411, name: "Already launched".to_string(),
                            message: "A process has already been launched can't launch another".to_string(),
                            data: 1
                        }))
                        .expect("failed to send");
                } else {
                    let (msg, cont) = match_debug_event(
                        &event, &mut symbols, &mut threads, &child
                    );
                    debug_continue = cont;

                    d_sndr.lock().unwrap().send(msg)
                        .expect("failed to send");
                    launched = true;
                }
            } 

            ServerMessage::Execute => {}
        }

        println!("[DEL] calling continue on the event");
        match event.continue_event(debug_continue) {
            Ok(a) => a,
            Err(_) => {
                d_sndr.lock().unwrap()
                    .send(DebugMessage::Err(Error {
                        code: 411, name: "Failed to continue".to_string(),
                        message: "Failed to continue thread".to_string(),
                        data: 1
                    }))
                    .expect("failed to send");
            }
        };
    }
}

/// @ /api/v1/debug/<debug_id>/execute -- Launches process if not running.  Continues otherwise
/// sends the Launch ServerMessage to the debug event loop
fn launch_process_handler(
    _req: Request, res: Response, c: Captures,
    s_sndr: Arc<Mutex<mpsc::SyncSender<ServerMessage>>>,
    s_rcvr: Arc<Mutex<mpsc::Receiver<DebugMessage>>>
) {
    println!("in launch_process_handler");

    let caps = c.unwrap();
    let debug_id = match caps[1].parse::<i32>() {
        Ok(x) => x,
        Err(_) => {
            send_json_msg(DebugMessage::Err(Error {
                code: 411, name: "bad id".to_string(),
                message: "no debug process with that id".to_string(),
                data: 1
            }), res);
            return;
        }
    };

    if debug_id == 1 { // this could be buggy if they provide url with 1 and we arent attached
        s_sndr.lock().unwrap()
            .send(ServerMessage::Launch)
            .expect("failed to send");

        let msg = match s_rcvr.lock().unwrap().recv() {
            Ok(m) => m,
            Err(_) => {
                DebugMessage::Err(Error {
                    code: 411, name: "Comm channel closed".to_string(),
                    message: "There was an error receiving message from debug thread".to_string(),
                    data: 1
                })
            }
        };
        send_json_msg(msg, res);
    }
}

/// Helper function to send debug event loop messages to the client
fn send_json_msg(msg: DebugMessage, res: Response) {
    println!("in send_json_msg");
    match msg {
        DebugMessage::AttachInfo(ai) => {
            let json_str = serde_json::to_string(&ai).unwrap();
            res.send(&json_str.into_bytes()).unwrap();
        }
        DebugMessage::Exec(e) => {
            let json_str = serde_json::to_string(&e).unwrap();
            res.send(&json_str.into_bytes()).unwrap();
        }
        DebugMessage::Err(e) => {
            let json_str = serde_json::to_string(&e).unwrap();
            res.send(&json_str.into_bytes()).unwrap();            
        }
    };

}

fn match_debug_event(
    event: &debug::DebugEvent, symbols: &mut debug::SymbolHandler,
    threads: &mut HashMap<u32, winapi::winnt::HANDLE>,
    child: &debug::Child
) -> (DebugMessage, bool) {
    println!("in match_debug_event");

    let mut debug_continue = false;

    use debug::DebugEventInfo::*;
    let message = match event.info {
        // FIXME: currently this ignores cp.hProcess and thus only supports a single child
        CreateProcess(cp) => {
            println!("[m_d_e] matched on CreateProcess debug event");
            threads.insert(event.thread_id, cp.hThread); //<u32, HANDLE

            symbols.load_module(cp.hFile, cp.lpBaseOfImage as usize)
                .expect("failed to load module");

            if cp.hFile != ptr::null_mut() {
                unsafe { kernel32::CloseHandle(cp.hFile) };
            }

            //TODO:
            // need a way to generate an execution id and then increment as stuff happens
            // figure out how to determine if it is a process or function execution
            // figure out how to get status
            // figure out how to get current execution time from debug lib
            DebugMessage::Exec(Execution{
                id: 16, eType: "process".to_string(), status: "executing".to_string(),
                executionTime: 1, data: 1
            })
        }

        ExitProcess(ep) => {
            DebugMessage::Err(Error {
                code: ep.dwExitCode as i32, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })
        }

        CreateThread(ct) => {
            println!(
                "create thread: {} {:#018x}",
                event.thread_id, unsafe { mem::transmute::<_, usize>(ct.lpStartAddress) }
            );

            threads.insert(event.thread_id, ct.hThread);

            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })
        }

        ExitThread(et) => {
            println!("exit thread: {} ({})", event.thread_id, et.dwExitCode);
            threads.remove(&event.thread_id);

            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })

        }

        LoadDll(ld) => {
            println!("load dll: {:#018x}", ld.lpBaseOfDll as usize);

            symbols.load_module(ld.hFile, ld.lpBaseOfDll as usize)
                .expect("failed to load module");

            if ld.hFile != ptr::null_mut() {
                unsafe { kernel32::CloseHandle(ld.hFile) };
            }
            
            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })
        }

        UnloadDll(ud) => {
            println!("unload dll: {:#018x}", ud.lpBaseOfDll as usize);
            let _ = symbols.unload_module(ud.lpBaseOfDll as usize);
            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })
        }

        OutputDebugString(ds) => {
            let mut buffer = vec![0u8; ds.nDebugStringLength as usize];
            child.read_memory(ds.lpDebugStringData as usize, &mut buffer)
                .expect("failed reading debug string");

            let string = String::from_utf8_lossy(&buffer);
            println!("{}", string);
            
            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(),
                data: 1
            })
        }

        Exception(e) => {
            let er = &e.ExceptionRecord;
            if e.dwFirstChance == 0 {
                DebugMessage::Err(Error {
                    code: 777, name: "TODO".to_string(),
                    message: "TODO".to_string(),
                    data: 1
                })
            } else {
                if er.ExceptionCode == winapi::EXCEPTION_BREAKPOINT {
                    debug_continue = true;
                }

                let address = er.ExceptionAddress as usize;
                let (symbol, off) = symbols.symbol_from_address(address)
                    .expect("failed to get symbol");

                let name = symbol.name.to_string_lossy();
                println!("exception {:x} at {}+{}", er.ExceptionCode, name, off);

                let walk = symbols.walk_stack(threads[&event.thread_id])
                    .expect("failed to walk thread stack");
                for frame in walk {
                    let ref context = frame.context;
                    let ref stack = frame.stack;

                    let address = stack.AddrPC.Offset as usize;
                    let (symbol, off) = symbols.symbol_from_address(address)
                        .expect("failed to get symbol");

                    let file_pos = symbols.line_from_address(address)
                        .map(|(line, _off)| {
                            format!("{}:{}", line.file.to_string_lossy(), line.line)
                        })
                        .unwrap_or(String::new());

                    let name = symbol.name.to_string_lossy();
                    println!("  0x{:016x} {}+{} {}", address, name, off, file_pos);

                    let instruction = stack.AddrPC.Offset as usize;
                    let _ = symbols.enumerate_symbols(instruction, |symbol, size| {
                        if size == 0 { return true; }

                        let name = symbol.name.to_string_lossy();

                        let mut buffer = vec![0u8; size];
                        match child.read_memory(
                            context.Rbp as usize + symbol.address, &mut buffer
                        ) {
                            Ok(_) => {
                                let value = match size {
                                    4 => unsafe { *(buffer.as_ptr() as *const u32) as u64 },
                                    8 => unsafe { *(buffer.as_ptr() as *const u64) as u64 },
                                    _ => unsafe { *(buffer.as_ptr() as *const u32) as u64 },
                                };
                                println!("    {} = {:x}", name, value);
                            }
                            Err(_) => println!("    {} = ?", name),
                        }

                        true
                    });
                }

                DebugMessage::Err(Error {
                    code: 777, name: "TODO".to_string(),
                    message: "TODO".to_string(), data: 777
                })
            }
        }

        Rip(..) => {
            DebugMessage::Err(Error {
                code: 777, name: "TODO".to_string(),
                message: "TODO".to_string(), data: 777
            })
        }
    };

    (message, debug_continue)
}

/// @ /debug
fn debug_info_handler(_:Request, res: Response, _: Captures) {
    println!("in debug_info_handler");
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/functions
fn debug_list_handler(_:Request, res: Response, _: Captures) {
    println!("in debug_list_handler");
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/functions/:function
fn function_info_handler(_:Request, res: Response, _: Captures) {
    println!("in function_info_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints
fn list_breakpoints_handler(_:Request, res: Response, _: Captures) {
    println!("in list_breakpoints_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints/:function -- Sets a breakpoint on given function
fn set_breakpoint_handler(_:Request, res: Response, _: Captures) {
    println!("in set_breakpoint_handler");
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints/:function -- Deletes a breakpoint
fn del_breakpoint_handler(_:Request, res: Response, _: Captures) {
    println!("in del_breakpoint_handler");
    res.send(b"He who controls the spice...").unwrap();
}


/// @ /debug/functions/:function/execute -- executes function with parameters in POST body
fn exec_func_handler(_:Request, res: Response, _: Captures) {
    println!("in exec_func_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions -- returns list of executions 
fn list_execs_handler(_:Request, res: Response, _: Captures) {
    println!("in list_execs_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/:executionId -- get information about execution status
fn exec_status_handler(_:Request, res: Response, _: Captures) {
    println!("in exec_status_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/executionId/trace -- Get trace data for execution
fn exec_trace_handler(_:Request, res: Response, _: Captures) {
    println!("in exec_trace_handler");    
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/:executionId/stop -- Halts a running execution
fn stop_exec_handler(_:Request, res: Response, _: Captures) {
    println!("in stop_exec_handler");    
    res.send(b"He who controls the spice...").unwrap();
}


fn main() {
    //install routes

    let mut router = Router::new();
    router.get("/greet", basic_handler); // debug line

    // comm channels for threads. We need a pair of them so that both the main server thread
    // and the debug thread can send and receive messages.
    // Leave buffer size at at zero so the send blocks until the receiving thread processes
    // the message.  This will change once rust has better async support

    // debug event send
    let (d_sndr, s_rcvr) = mpsc::sync_channel::<DebugMessage>(0);
    let d_sndr = Arc::new(Mutex::new(d_sndr));
    let s_rcvr = Arc::new(Mutex::new(s_rcvr));

    //server send
    let (s_sndr, d_rcvr) = mpsc::sync_channel::<ServerMessage>(0);
    let s_sndr = Arc::new(Mutex::new(s_sndr));
    let d_rcvr = Arc::new(Mutex::new(d_rcvr));

    router.get(FILE_SYS_END_PT, filesystem_handler);
    router.get(PROCESS_END_PT, process_handler);
    router.post(DEBUG_ATCH_PID_END_PT, attach_pid_handler);

    let s_rcvr2 = s_rcvr.clone();
    router.post(DEBUG_ATCH_BIN_END_PT, move |req, res, c| {
        attach_bin_handler(req, res, c, d_sndr.clone(), d_rcvr.clone(), s_rcvr2.clone());
    });

    router.get(DEBUG_END_PT, debug_info_handler);
    router.get(DEBUG_FUNC_LST_END_PT, debug_list_handler);
    router.get(DEBUG_FUNC_END_PT, function_info_handler);
    router.get(BRKPNT_END_PT, list_breakpoints_handler);
    router.put(FUNC_BRKPNT_END_PT, set_breakpoint_handler);
    router.delete(FUNC_BRKPNT_END_PT, del_breakpoint_handler);

    let s_sndr2 = s_sndr.clone();
    let s_rcvr2 = s_rcvr.clone();
    router.post(DEBUG_EXEC_PROC_END_PT, move |req, res, c| {
        launch_process_handler(req, res, c, s_sndr2.clone(), s_rcvr2.clone());
    });

    router.post(DEBUG_EXEC_FUNC_END_PT, exec_func_handler);
    router.get(DEBUG_EXEC_LST_END_PT, list_execs_handler);
    router.get(DEBUG_EXEC_STATUS_END_PT, exec_status_handler);
    router.get(DEBUG_EXEC_TRACE_END_PT, exec_trace_handler);
    router.post(DEBUG_EXEC_STOP_END_PT, stop_exec_handler);

    router.finalize().unwrap();

    let server = Server::http("127.0.0.1:3000").unwrap();
    server.handle(router).unwrap();
}
