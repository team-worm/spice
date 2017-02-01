use std::{io, ptr, mem};
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
        let _ = file.as_ref().ok_or(io::Error::from(io::ErrorKind::Other))
            .and_then(|file| state.symbols.load_module(file, base));

        state.threads.insert(event.thread_id, main_thread);
        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }

    let mut event = Some(event);
    loop {
        match rx.recv().unwrap() {
            ServerMessage::ListFunctions => {
                let message = list_functions(&mut state)
                    .map(DebugMessage::Functions)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::DescribeFunction { address } => {
                let message = describe_function(&mut state, address)
                    .map(DebugMessage::Function)
                    .unwrap_or_else(DebugMessage::Error);

                tx.send(message).unwrap();
            }

            ServerMessage::ListBreakpoints => {}

            ServerMessage::SetBreakpoint { address } => {
                let message = set_breakpoint(&mut state, address)
                    .map(|breakpoints| {
                        let breakpoints = breakpoints.into_iter()
                            .map(|(address, breakpoint)| (address, Some(breakpoint)));
                        state.breakpoints.extend(breakpoints);

                        DebugMessage::Breakpoint
                    })
                    .unwrap_or_else(DebugMessage::Error);

                tx.send(message).unwrap();
            }

            ServerMessage::ClearBreakpoint { .. } => {}

            ServerMessage::Continue => {
                let message = event.take().ok_or(io::Error::new(io::ErrorKind::Other, "Nothing to continue"))
                    .and_then(|event| event.continue_event(true))
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);

                tx.send(message).unwrap();
            }

            ServerMessage::CallFunction { .. } => {}

            // TODO: handle process-type traces
            ServerMessage::Trace => {
                assert!(event.is_none());
                event = trace_function(&mut state, &tx)
                    .unwrap_or_else(|(error, event)| {
                        tx.send(DebugMessage::Error(error)).unwrap();
                        event
                    });
            }

            ServerMessage::Stop => {}

            ServerMessage::Quit => {
                state.child.terminate()?;
                break;
            }
        }
    }


    Ok(())
}

fn list_functions(state: &mut DebugState) -> io::Result<Vec<Function>> {
    let DebugState { ref symbols, .. } = *state;

    let mut functions = vec![];
    symbols.enumerate_globals(|symbol, _| {
        functions.push(symbol.address);
        true
    })?;

    let functions: Vec<_> = functions.into_iter()
        .flat_map(|address| describe_function(state, address))
        .collect();

    Ok((functions))
}

fn describe_function(state: &DebugState, address: usize) -> io::Result<Function> {
    let DebugState { ref symbols, .. } = *state;

    let (function, _) = symbols.symbol_from_address(address)?;
    let module = symbols.module_from_address(address)?;
    let _fn_type = symbols.type_from_index(module, function.type_index)?;

    let debug::Symbol { ref name, size, .. } = function;

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

struct BreakpointTransaction<'a>(&'a mut debug::Child, HashMap<usize, debug::Breakpoint>);

impl<'a> Drop for BreakpointTransaction<'a> {
    fn drop(&mut self) {
        let BreakpointTransaction(ref mut child, ref mut breakpoints) = *self;

        for (_address, breakpoint) in breakpoints.drain() {
            let _ = child.remove_breakpoint(breakpoint);
        }
    }
}

impl<'a> BreakpointTransaction<'a> {
    fn commit(self) -> HashMap<usize, debug::Breakpoint> {
        let breakpoints = unsafe { ptr::read(&self.1) };
        mem::forget(self);

        breakpoints
    }
}

fn set_breakpoint(state: &mut DebugState, address: usize) -> io::Result<HashMap<usize, debug::Breakpoint>> {
    let DebugState { ref symbols, ref mut child, .. } = *state;

    let (function, _off) = symbols.symbol_from_address(address)?;
    let lines = symbols.lines_from_symbol(&function)?;

    let mut breakpoints = BreakpointTransaction(child, HashMap::new());
    for line in lines {
        let breakpoint = breakpoints.0.set_breakpoint(line.address)?;
        breakpoints.1.insert(line.address, breakpoint);
    }

    Ok(breakpoints.commit())
}

fn trace_function(
    state: &mut DebugState, tx: &SyncSender<DebugMessage>
) -> Result<Option<debug::Event>, (io::Error, Option<debug::Event>)> {
    let mut last_line = 0;
    loop {
        let event = debug::Event::wait_event()
            .map_err(|e| (e, None))?;

        use debug::EventInfo::*;
        match event.info {
            ExitProcess { .. } => {
                tx.send(DebugMessage::Trace(DebugTrace::Terminated(last_line))).unwrap();
                return Ok(Some(event));
            }

            CreateThread { thread, .. } => { state.threads.insert(event.thread_id, thread); }
            ExitThread { .. } => { state.threads.remove(&event.thread_id); }

            LoadDll { ref file, base } => {
                let _ = file.as_ref().ok_or(io::Error::from(io::ErrorKind::Other))
                    .and_then(|file| state.symbols.load_module(file, base));
            }
            UnloadDll { base } => { let _ = state.symbols.unload_module(base); }

            Exception { first_chance, code, address } => {
                let thread = state.threads[&event.thread_id];

                if !state.attached {
                    state.attached = true;
                } else if !first_chance {
                } else if code == winapi::EXCEPTION_BREAKPOINT {
                    // disable and save the breakpoint
                    let breakpoint = match state.breakpoints.get_mut(&address) {
                        Some(breakpoint) => breakpoint.take(),
                        None => {
                            event.continue_event(true)
                                .map_err(|e| (e, None))?;
                            continue;
                        }
                    };

                    let (line, locals) = match trace_breakpoint(state, address, breakpoint.unwrap(), thread) {
                        Ok((line, locals)) => (line, locals),
                        Err(e) => return Err((e, Some(event))),
                    };

                    tx.send(DebugMessage::Trace(DebugTrace::Line(last_line, locals))).unwrap();
                    last_line = line.line;
                } else if code == winapi::EXCEPTION_SINGLE_STEP {
                    if let Err(e) = trace_step(state, thread) {
                        return Err((e, Some(event)));
                    }
                }
            }

            _ => {}
        }

        event.continue_event(true)
            .map_err(|e| (e, None))?;
    }
}

fn trace_breakpoint(
    state: &mut DebugState, address: usize, breakpoint: debug::Breakpoint, thread: RawHandle
) -> io::Result<(debug::Line, Vec<(String, String)>)> {
    let DebugState { ref mut child, ref mut symbols, ref mut last_breakpoint, .. } = *state;

    child.remove_breakpoint(breakpoint)?;
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

    Ok((line, locals))
}

fn trace_step(state: &mut DebugState, thread: RawHandle) -> io::Result<()> {
    let DebugState { ref mut child, ref mut breakpoints, ref mut last_breakpoint, .. } = *state;

    // restore the disabled breakpoint
    let address = last_breakpoint.take().unwrap();
    let breakpoint = child.set_breakpoint(address)?;
    breakpoints.insert(address, Some(breakpoint));

    // disable singlestep
    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;
    context.set_singlestep(false);
    debug::set_thread_context(thread, &context)?;

    Ok(())
}


