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
    Error(io::Error),
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
    Line(u32, Vec<(String, u64)>),
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
                debug_tx.send(DebugMessage::Error(e)).unwrap();
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
        state.symbols.load_module(file.as_ref().unwrap(), base)?;
        state.threads.insert(event.thread_id, main_thread);

        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }

    let mut event = Some(event);
    loop {
        match rx.recv().unwrap() {
            ServerMessage::ListFunctions => {
                list_functions(&mut state, &tx)?;
            }
            ServerMessage::DescribeFunction { address } => {
                let (function, _) = state.symbols.symbol_from_address(address)?;
                let function = describe_function(&mut state.symbols, &function)?;
                tx.send(DebugMessage::Function(function)).unwrap();
            }

            ServerMessage::ListBreakpoints => {}

            ServerMessage::SetBreakpoint { address } => {
                let (function, _off) = state.symbols.symbol_from_address(address)?;
                let lines = state.symbols.lines_from_symbol(&function)?;
                for line in lines {
                    let breakpoint = state.child.set_breakpoint(line.address)?;
                    state.breakpoints.insert(line.address, Some(breakpoint));
                }

                tx.send(DebugMessage::Breakpoint).unwrap();
            }

            ServerMessage::ClearBreakpoint { .. } => {}

            ServerMessage::Continue => {
                event.take().unwrap().continue_event(true)?;
                tx.send(DebugMessage::Executing).unwrap();
            }

            ServerMessage::CallFunction { .. } => {}

            // TODO: handle process-type traces
            ServerMessage::Trace => {
                assert!(event.is_none());
                event = Some(trace_function(&mut state, &tx)?);
            }

            ServerMessage::Stop => {}

            ServerMessage::Quit => { break; }
        }
    }

    Ok(())
}

fn list_functions(
    state: &mut DebugState, tx: &SyncSender<DebugMessage>
) -> io::Result<()> {
    let DebugState { ref mut symbols, .. } = *state;

    let mut functions = vec![];
    symbols.enumerate_functions(|function, _| {
        functions.push(function.clone());
        true
    })?;

    let functions: Vec<_> = functions.into_iter()
        .flat_map(|function| describe_function(symbols, &function))
        .collect();
    tx.send(DebugMessage::Functions(functions)).unwrap();
    Ok(())
}

fn describe_function(
    symbols: &mut debug::SymbolHandler, function: &debug::Symbol
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

                            let value = match size {
                                4 => unsafe { *(buffer.as_ptr() as *const u32) as u64 },
                                8 => unsafe { *(buffer.as_ptr() as *const u64) as u64 },
                                _ => unsafe { *(buffer.as_ptr() as *const u32) as u64 },
                            };

                            locals.push((name, value));
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
