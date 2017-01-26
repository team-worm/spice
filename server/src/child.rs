use std::io;
use std::collections::HashMap;
use std::path::PathBuf;
use std::ffi::OsString;
use std::sync::mpsc::{sync_channel, SyncSender, Receiver};
use std::thread;
use std::thread::JoinHandle;
use std::os::windows::io::RawHandle;

use debug;
use winapi;

pub struct Thread {
    pub thread: JoinHandle<()>,
    pub tx: SyncSender<ServerMessage>,
    pub rx: Receiver<DebugMessage>,
}

/// messages the debug event loop sends to the server
pub enum DebugMessage {
    Attached,
    Functions(Vec<Function>),
    Function(Function),
    Breakpoint,
    Executing,
    Trace(DebugTrace),
    Error(String, io::Error),
}

pub struct Function {
    pub address: usize,
    pub name: OsString,
    pub source_path: PathBuf,
    pub line_number: u32,
    pub line_count: u32,
    pub parameters: Vec<(i32, OsString, usize)>,
    pub local_variables: Vec<(i32, OsString, usize)>,
}

pub enum DebugTrace {
    Line(u32, Vec<(String, String)>),
    Terminated(u32),
}

/// messages the server sends to the debug event loop to request info
// TODO: remove this once these messages are used
#[allow(dead_code)]
pub enum ServerMessage {
    ListFunctions,
    DescribeFunction { address: usize },
    ListBreakpoints,
    SetBreakpoint { address: usize },
    ClearBreakpoint { address: usize },
    Continue,
    CallFunction { address: usize },
    Trace,
    Stop,
    Quit,
}

impl Thread {
    pub fn launch(path: PathBuf) -> Thread {
        Thread::spawn(move |debug_tx, server_rx| {
            let child = debug::Command::new(&path)
                .env_clear()
                .debug()?;

            run(child, debug_tx, server_rx)
        })
    }

    pub fn attach(pid: u32) -> Thread {
        Thread::spawn(move |debug_tx, server_rx| {
            let child = debug::Child::attach(pid)?;

            run(child, debug_tx, server_rx)
        })
    }

    fn spawn<F>(f: F) -> Thread where
        F: FnOnce(SyncSender<DebugMessage>, Receiver<ServerMessage>) -> io::Result<()>,
        F: Send + 'static
    {
        let (server_tx, server_rx) = sync_channel(0);
        let (debug_tx, debug_rx) = sync_channel(0);

        let thread = thread::spawn(move || {
            if let Err(e) = f(debug_tx.clone(), server_rx) {
                debug_tx.send(DebugMessage::Error(format!("Failed to spawn thread"), e)).unwrap();
            }
        });

        Thread {
            thread: thread,
            tx: server_tx,
            rx: debug_rx,
        }
    }
}

struct DebugState {
    child: debug::Child,
    symbols: debug::SymbolHandler,
    attached: bool,

    threads: HashMap<winapi::DWORD, RawHandle>,
    breakpoints: HashMap<usize, Option<debug::Breakpoint>>,
    last_breakpoint: Option<usize>,
}

fn run(
    child: debug::Child, tx: SyncSender<DebugMessage>, rx: Receiver<ServerMessage>
) -> io::Result<()> {
    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let symbols = debug::SymbolHandler::initialize(&child)?;

    let mut state = DebugState {
        child: child,
        symbols: symbols,
        attached: false,

        threads: HashMap::new(),
        breakpoints: HashMap::new(),
        last_breakpoint: None,
    };

    let event = debug::Event::wait_event()?;
    if let debug::EventInfo::CreateProcess { ref file, main_thread, base, .. } = event.info {
        match state.symbols.load_module(file.as_ref().unwrap(), base) {
            Ok(_) => {},
            Err(err) => {
                tx.send(DebugMessage::Error(
                    format!("Error loading modules during create process"),
                    err,
                )).unwrap();
                return Ok(());
            },
        };
        state.threads.insert(event.thread_id, main_thread);

        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }

    let mut event = Some(event);
    loop {
        match rx.recv().unwrap() {
            ServerMessage::ListFunctions => {
                match list_functions(&mut state) {
                    Ok(functions) => tx.send(DebugMessage::Functions(functions)).unwrap(),
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error getting list of functions"),
                            err)).unwrap();
                    },
                }
            }
            ServerMessage::DescribeFunction { address } => {
                let (function, _) = match state.symbols.symbol_from_address(address) {
                    Ok((symbol, size)) => (symbol, size),
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error loading function information"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };
                
                let module = match state.symbols.module_from_address(address) {
                    Ok(m) => m,
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error loading function from address"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };
                let fn_type = match state.symbols.type_from_index(module, function.type_index) {
                    Ok(t) => t,
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error getting function return type"),
                            err,
                        )).unwrap();
                        continue;
                    },
                    
                };
                let function = match describe_function(&mut state.symbols, &function, &fn_type) {
                    Ok(func) => func,
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error gathering information about the function"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };
                tx.send(DebugMessage::Function(function)).unwrap();
            }

            ServerMessage::ListBreakpoints => {}

            ServerMessage::SetBreakpoint { address } => {
                let (function, _off) = match state.symbols.symbol_from_address(address){
                    Ok((symbol, offset)) => (symbol, offset),
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error getting symbol from address"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };
                let lines = match state.symbols.lines_from_symbol(&function) {
                    Ok(l) => l,
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("Error iterating over lines of a function"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };

                let mut success = true;
                for line in lines {
                    let breakpoint = match state.child.set_breakpoint(line.address){
                        Ok(bp) => bp,
                        Err(err) => {
                            tx.send(DebugMessage::Error(
                                format!("Error placing breakpoint on line number {}", line.line),
                                err,
                            )).unwrap();
                            success = false;
                            break;
                        },
                    };
                    state.breakpoints.insert(line.address, Some(breakpoint));
                }

                if success {
                    tx.send(DebugMessage::Breakpoint).unwrap();                    
                } else {
                    state.breakpoints = HashMap::new();
                }
            }

            ServerMessage::ClearBreakpoint { .. } => {}

            ServerMessage::Continue => {
                match event.take().unwrap().continue_event(true) {
                    Ok(_) => {},
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("There was an error in the debugging process.  You will have to reattach"),
                            err,
                        )).unwrap();
                        continue;
                    },
                };
                tx.send(DebugMessage::Executing).unwrap();
            }

            ServerMessage::CallFunction { .. } => {}

            // TODO: handle process-type traces
            ServerMessage::Trace => {
                assert!(event.is_none());
                // Error handling may have to become more fine grained for trace
                event = Some(match trace_function(&mut state, &tx) {
                    Ok(debug_event) => debug_event,
                    Err(err) => {
                        tx.send(DebugMessage::Error(
                            format!("There was an error executing trace.  Try again."),
                            err,
                        )).unwrap();
                        continue;
                    },
                });
            }

            ServerMessage::Stop => {}

            ServerMessage::Quit => { break; }
        }
    }
    

    Ok(())
}

fn list_functions(state: &DebugState) -> io::Result<(Vec<Function>)> {
    let DebugState { ref symbols, .. } = *state;

    let mut functions = vec![];
    match symbols.enumerate_globals(|symbol, _| {
        let module = symbols.module_from_address(symbol.address).unwrap(); 
        let fn_type = match symbols.type_from_index(module, symbol.type_index) {
            Ok(fn_type @ debug::Type::Function { .. }) => fn_type,
            _ => return true,
        };

        functions.push((symbol, fn_type));
        true
    }){
        Ok(_) => {},
        Err(e) => {
            return Err(e);  
        },
    };

    let functions: Vec<_> = functions.into_iter()
        .flat_map(|(function, fn_type)| describe_function(symbols, &function, &fn_type))
        .collect();
//    tx.send(DebugMessage::Functions(functions)).unwrap();
    Ok((functions))
}

fn describe_function(
    symbols: &debug::SymbolHandler, function: &debug::Symbol, _fn_type: &debug::Type
) -> io::Result<Function> {
    let debug::Symbol { ref name, address, size, .. } = *function;

    let start = match symbols.line_from_address(address) {
        Ok((line, _)) => line,
        Err(_) => return Err(io::Error::from(io::ErrorKind::NotFound)),
    };
    let end = match symbols.line_from_address(address + size - 1) {
        Ok((line, _)) => line,
        Err(_) => return Err(io::Error::from(io::ErrorKind::NotFound)),
    };

    let mut id = 0;

    let mut parameters = vec![];
    symbols.enumerate_locals(address, |symbol, _| {
        if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
            parameters.push((id, symbol.name.clone(), symbol.address));
            id += 1;
        }
        true
    })?;

    let mut locals = HashMap::new();
    for line in symbols.lines_from_symbol(&function)? {
        symbols.enumerate_locals(line.address, |symbol, _| {
            if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
                let name = symbol.name.clone();
                locals.entry(name).or_insert_with(|| {
                    let this_id = id;
                    id += 1;
                    (this_id, symbol.address)
                });
            }
            true
        })?;
    }
    let local_variables = locals.into_iter()
        .map(|(name, (id, address))| (id, name, address))
        .collect();

    Ok(Function {
        address: address,
        name: name.clone(),
        source_path: PathBuf::from(&start.file),
        line_number: start.line,
        line_count: end.line - start.line + 1,
        parameters: parameters,
        local_variables: local_variables,
    })
}

fn trace_function(
    state: &mut DebugState, tx: &SyncSender<DebugMessage>
) -> io::Result<debug::Event> {
    let DebugState {
        ref mut child,
        ref mut symbols,
        ref mut attached,

        ref mut threads,
        ref mut breakpoints,
        ref mut last_breakpoint,
    } = *state;

    let mut last_line = 0;
    loop {
        let event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            ExitProcess { .. } => {
                tx.send(DebugMessage::Trace(DebugTrace::Terminated(last_line))).unwrap();
                return Ok(event);
            }

            CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
            ExitThread { .. } => { threads.remove(&event.thread_id); }

            LoadDll { ref file, base } => { symbols.load_module(file.as_ref().unwrap(), base)?; }
            UnloadDll { base } => { symbols.unload_module(base)?; }

            Exception { first_chance, code, address } => {
                let thread = threads[&event.thread_id];

                if !*attached {
                    *attached = true;
                } else if !first_chance {
                } else if code == winapi::EXCEPTION_BREAKPOINT {
                    // disable and save the breakpoint
                    let breakpoint = breakpoints.get_mut(&address).unwrap().take();
                    child.remove_breakpoint(breakpoint.unwrap())?;
                    *last_breakpoint = Some(address);

                    // restart the instruction and enable singlestep
                    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;
                    context.set_instruction_pointer(address);
                    context.set_singlestep(true);
                    debug::set_thread_context(thread, &context)?;

                    // collect locals

                    let frame = symbols.walk_stack(thread)?.nth(0).unwrap();
                    let ref context = frame.context;
                    let ref stack = frame.stack;

                    let instruction = stack.AddrPC.Offset as usize;
                    let (line, _off) = symbols.line_from_address(instruction)?;

                    let mut locals = vec![];
                    symbols.enumerate_locals(instruction, |symbol, size| {
                        if size == 0 { return true; }

                        let mut buffer = vec![0u8; size];
                        let address = context.Rbp as usize + symbol.address;
                        if let Ok(_) = child.read_memory(address, &mut buffer) {
                            let name = symbol.name.to_string_lossy().into_owned();

                            let value = debug::Value::read(&child, &context, &symbols, &symbol);
                            if let Ok(value) = value {
                                if value.data[0] == 0xcc {
                                    return true;
                                }

                                locals.push((name, format!("{}", value.display(&symbols))));
                            }
                        }

                        true
                    })?;

                    tx.send(DebugMessage::Trace(DebugTrace::Line(last_line, locals))).unwrap();
                    last_line = line.line;
                } else if code == winapi::EXCEPTION_SINGLE_STEP {
                    // restore the disabled breakpoint
                    let address = last_breakpoint.take().unwrap();
                    let breakpoint = child.set_breakpoint(address)?;
                    breakpoints.insert(address, Some(breakpoint));

                    // disable singlestep
                    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;
                    context.set_singlestep(false);
                    debug::set_thread_context(thread, &context)?;
                }
            }

            _ => {}
        }

        event.continue_event(true)?;
    }
}
