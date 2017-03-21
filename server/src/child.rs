use std::{io, mem};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, SyncSender, Receiver};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::PathBuf;
use std::ffi::OsString;
use std::thread::{self, JoinHandle};
use std::os::windows::io::RawHandle;

use debug;
use winapi;
use trace::*;

pub struct Thread {
    pub thread: JoinHandle<()>,
    pub tx: SyncSender<ServerMessage>,
    pub rx: Receiver<DebugMessage>,

    pub execution: Option<(i32, Execution)>,
    pub id: i32,
}

pub enum Execution {
    Process,
    Function(usize),
}

/// messages the debug event loop sends to the server
pub enum DebugMessage {
    Attached(debug::Cancel),
    Functions(Vec<Function>),
    Function(Function),
    Breakpoints(Vec<usize>),
    Breakpoint,
    BreakpointRemoved,
    Executing,
    Trace(DebugTrace),
    Error(io::Error),
}

pub struct Function {
    pub address: usize,
    pub name: OsString,
    pub source_path: PathBuf,
    pub line_start: u32,
    pub line_count: u32,
    pub parameters: Vec<(OsString, usize)>,
    pub locals: Vec<(OsString, usize)>,
}

pub enum DebugTrace {
    Line(u32, Vec<(String, String)>),
    Call(u32, usize),
    Return(u32, String),

    Breakpoint(usize),
    Exit(u32),
    Cancel,
    Crash(String),
}

/// messages the server sends to the debug event loop to request info
pub enum ServerMessage {
    ListFunctions,
    DescribeFunction { address: usize },
    ListBreakpoints,
    SetBreakpoint { address: usize },
    ClearBreakpoint { address: usize },
    Continue,
    CallFunction { address: usize, arguments: Vec<i32> },
    Trace,
    Quit,
}

impl Thread {
    pub fn launch(path: PathBuf) -> (Thread, Arc<AtomicBool>) {
        Thread::spawn(move |debug_tx, server_rx, cancel| {
            let child = debug::Command::new(&path)
                .env_clear()
                .debug()?;

            run(child, debug_tx, server_rx, cancel)
        })
    }

    pub fn attach(pid: u32) -> (Thread, Arc<AtomicBool>) {
        Thread::spawn(move |debug_tx, server_rx, cancel| {
            let child = debug::Child::attach(pid)?;

            run(child, debug_tx, server_rx, cancel)
        })
    }

    fn spawn<F>(f: F) -> (Thread, Arc<AtomicBool>) where
        F: FnOnce(SyncSender<DebugMessage>, Receiver<ServerMessage>, Arc<AtomicBool>)
            -> io::Result<()>,
        F: Send + 'static
    {
        let (server_tx, server_rx) = sync_channel(0);
        let (debug_tx, debug_rx) = sync_channel(0);
        let cancel_flag = Arc::new(AtomicBool::new(false));

        let cancel = cancel_flag.clone();
        let thread = thread::spawn(move || {
            if let Err(e) = f(debug_tx.clone(), server_rx, cancel) {
                debug_tx.send(DebugMessage::Error(e)).unwrap();
            }
        });

        let thread = Thread {
            thread: thread,
            tx: server_tx,
            rx: debug_rx,

            execution: None,
            id: -1,
        };

        (thread, cancel_flag)
    }

    pub fn next_id(&mut self) -> i32 {
        self.id += 1;
        self.id
    }
}

struct TargetState {
    child: debug::Child,
    symbols: debug::SymbolHandler,

    breakpoints: BreakpointSet,
    traces: HashMap<usize, BreakpointSet>,
}

struct DebugState {
    threads: HashMap<winapi::DWORD, RawHandle>,
    execution: Option<ExecutionState>,
    event: Option<debug::Event>,
    last_call: Option<usize>,
}

enum ExecutionState {
    Process,

    Function {
        call: debug::Call,
        thread: RawHandle,

        entry: usize,
        exit: usize,
        stack: usize,
    },
}

fn run(
    child: debug::Child, tx: SyncSender<DebugMessage>, rx: Receiver<ServerMessage>,
    cancel: Arc<AtomicBool>
) -> io::Result<()> {
    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let symbols = debug::SymbolHandler::initialize(&child)?;

    let mut target = TargetState {
        child: child,
        symbols: symbols,

        breakpoints: BreakpointSet::new(),
        traces: HashMap::new(),
    };

    let mut state = DebugState {
        threads: HashMap::new(),
        execution: None,
        event: None,
        last_call: None,
    };

    let mut last_thread;

    let event = debug::Event::wait_event()?;
    if let debug::EventInfo::CreateProcess { ref file, main_thread, base, .. } = event.info {
        let _ = file.as_ref()
            .ok_or(io::Error::new(io::ErrorKind::Other, "no file handle for CreateProcess"))
            .and_then(|file| target.symbols.load_module(file, base));

        last_thread = main_thread;
        state.threads.insert(event.thread_id, main_thread);
        tx.send(DebugMessage::Attached(target.child.get_cancel())).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }
    event.continue_event(true)?;

    loop {
        let mut event = debug::Event::wait_event()?;
        state.event = Some(event);

        match trace_default(&target, &mut state, &tx, &cancel, None, &mut true, true)? {
            None => (),
            Some(TraceEvent::Attach) => break,
            Some(_) => panic!("got a TraceEvent before attach"),
        }

        event = state.event.take().unwrap();
        event.continue_event(true)?;
    }

    let mut breakpoint_added = false;
    loop {
        match rx.recv().unwrap() {
            ServerMessage::ListFunctions => {
                let message = list_functions(&target)
                    .map(DebugMessage::Functions)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::DescribeFunction { address } => {
                let message = describe_function(&target, address)
                    .map(DebugMessage::Function)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::ListBreakpoints => {
                let breakpoints = target.breakpoints.keys().cloned().collect();
                let message = DebugMessage::Breakpoints(breakpoints);
                tx.send(message).unwrap();
            }

            ServerMessage::SetBreakpoint { address } => {
                let message = set_breakpoint(&mut target, address)
                    .map(|()| DebugMessage::Breakpoint)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::ClearBreakpoint { address } => {
                let message = remove_breakpoint(&mut target, address)
                    .map(|()| DebugMessage::BreakpointRemoved)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::Continue => {
                let message = continue_process(&mut state)
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::CallFunction { address, arguments } => {
                let thread = last_thread;
                breakpoint_added = !target.breakpoints.contains_key(&address);
                let message = call_function(&mut target, &mut state, thread, address, arguments)
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::Trace => {
                assert!(state.event.is_none());

                let result = match state.execution.take() {
                    Some(ex @ ExecutionState::Process) => {
                        trace_process(&target, &mut state, &tx, &cancel, ex)
                    }

                    Some(ex @ ExecutionState::Function { .. }) => {
                        let (thread, entry) = match ex {
                            ExecutionState::Function { thread, entry, .. } => (thread, entry),
                            _ => unreachable!(),
                        };

                        last_thread = thread;
                        trace_function(&target, &mut state, &tx, &cancel, ex, 0)
                            .and_then(|_| if breakpoint_added {
                                breakpoint_added = false;
                                remove_breakpoint(&mut target, entry)
                            } else {
                                Ok(())
                            })
                    }

                    None => Err(io::Error::from(io::ErrorKind::NotFound)),
                };

                if let Err(e) = result {
                    tx.send(DebugMessage::Error(e)).unwrap();
                }
            }

            ServerMessage::Quit => {
                let _ = target.child.terminate();
                break;
            }
        }
    }

    Ok(())
}

fn list_functions(target: &TargetState) -> io::Result<Vec<Function>> {
    let TargetState { ref symbols, .. } = *target;

    let mut functions = vec![];
    symbols.enumerate_globals(|symbol, _| {
        functions.push(symbol.address);
        true
    })?;

    let functions: Vec<_> = functions.into_iter()
        .flat_map(|address| describe_function(target, address))
        .collect();

    Ok((functions))
}

fn describe_function(target: &TargetState, address: usize) -> io::Result<Function> {
    let TargetState { ref symbols, .. } = *target;

    let (function, _) = symbols.symbol_from_address(address)?;
    let module = symbols.module_from_address(address)?;
    let _fn_type = symbols.type_from_index(module, function.type_index)?;

    let debug::Symbol { ref name, size, .. } = function;

    let (start, _) = symbols.line_from_address(address)?;
    let (end, _) = symbols.line_from_address(address + size - 1)?;

    let mut parameters = vec![];
    symbols.enumerate_locals(address, |symbol, _| {
        if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
            parameters.push((symbol.name.clone(), symbol.address));
        }
        true
    })?;

    let mut locals = HashMap::new();
    for line in symbols.lines_from_symbol(&function)? {
        symbols.enumerate_locals(line.address, |symbol, _| {
            if symbol.flags & winapi::SYMFLAG_PARAMETER == 0 {
                let name = symbol.name.clone();
                locals.entry(name).or_insert(symbol.address);
            }
            true
        })?;
    }
    let locals = locals.into_iter().collect();

    Ok(Function {
        address: address,
        name: name.clone(),
        source_path: PathBuf::from(&start.file),
        line_start: start.line,
        line_count: end.line - start.line + 1,
        parameters: parameters,
        locals: locals,
    })
}

fn set_breakpoint(target: &mut TargetState, address: usize) -> io::Result<()> {
    let TargetState { ref child, ref symbols, ref mut breakpoints, ref mut traces } = *target;

    let (function, offset) = symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    if breakpoints.contains_key(&address) {
        return Ok(());
    }

    let mut trace = BreakpointSet::new();
    for line in symbols.lines_from_symbol(&function)?.skip(1) {
        trace.insert(line.address, RefCell::new(None));
    }

    let breakpoint = RefCell::new(Some(child.set_breakpoint(address)?));
    breakpoints.insert(address, breakpoint);
    traces.insert(address, trace);

    Ok(())
}

fn remove_breakpoint(target: &mut TargetState, address: usize) -> io::Result<()> {
    let TargetState { ref child, ref mut breakpoints, ref mut traces, .. } = *target;

    let breakpoint = breakpoints.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::NotFound, "no such breakpoint"))?;
    let _ = traces.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::Other, "missing function trace"))?;

    child.remove_breakpoint(breakpoint.into_inner().unwrap())?;

    Ok(())
}

fn continue_process(state: &mut DebugState) -> io::Result<()> {
    let event = state.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    state.execution = Some(ExecutionState::Process);

    event.continue_event(true)?;
    Ok(())
}

fn trace_process(
    target: &TargetState, state: &mut DebugState,
    tx: &SyncSender<DebugMessage>, cancel: &AtomicBool,
    execution: ExecutionState
) -> io::Result<()> {
    let _ = match execution {
        ExecutionState::Process => (),
        _ => unreachable!(),
    };

    let mut cancelled = false;
    loop {
        let mut event = debug::Event::wait_event()?;
        state.event = Some(event);

        let trace_event = trace_default(target, state, tx, &cancel, None, &mut true, false)?;

        if let Some(TraceEvent::Call(ex @ ExecutionState::Function { .. })) = trace_event {
            let address = match ex {
                ExecutionState::Function { entry, .. } => entry,
                _ => unreachable!(),
            };
            tx.send(DebugMessage::Trace(DebugTrace::Breakpoint(address))).unwrap();
            state.execution = Some(ex);

            event = state.event.take().unwrap();
            event.continue_event(true)?;
            return Ok(());
        }

        if let Some(TraceEvent::Exception) = trace_event {
            event = state.event.take().unwrap();
            event.continue_event(false)?;

            continue;
        }

        if let Some(TraceEvent::Cancel) = trace_event {
            cancelled = true;
        }

        if let Some(TraceEvent::Terminate) = trace_event {
            return Ok(());
        }

        if cancelled && state.last_call.is_none() {
            return Ok(());
        }

        event = state.event.take().unwrap();
        event.continue_event(true)?;
    }
}

fn call_function(
    target: &mut TargetState, state: &mut DebugState,
    thread: RawHandle, address: usize, arguments: Vec<i32>
) -> io::Result<()> {
    let mut event = state.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    let (function, offset) = target.symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    state.event = Some(event);
    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

    set_breakpoint(target, address)?;

    // collect location data
    let entry = address;
    let exit = context.instruction_pointer();

    // set up the call
    let arg_type = debug::Type::Base { base: debug::Primitive::Int { signed: true }, size: 4 };
    let args: Vec<_> = arguments.into_iter()
        .map(|arg| debug::Value::new(arg, arg_type.clone()))
        .collect();
    let call = debug::Call::setup(&target.child, &target.symbols, &mut context, &function, args)?;

    let stack = context.stack_pointer() + mem::size_of::<usize>();

    debug::set_thread_context(thread, &context)?;
    event = state.event.take().unwrap();

    // move to a new execution
    state.execution = Some(ExecutionState::Function { call, thread, entry, exit, stack });

    event.continue_event(true)?;
    Ok(())
}

enum TraceEvent {
    Attach,
    Call(ExecutionState),
    Exception,
    Cancel,
    Terminate,
}

fn trace_function(
    target: &TargetState, state: &mut DebugState,
    tx: &SyncSender<DebugMessage>, cancel: &AtomicBool,
    execution: ExecutionState, last_line: u32
) -> io::Result<Option<TraceEvent>> {
    let (call, thread, entry, exit, stack) = match execution {
        ExecutionState::Function { call, thread, entry, exit, stack } =>
            (call, thread, entry, exit, stack),
        _ => unreachable!(),
    };
    tx.send(DebugMessage::Trace(DebugTrace::Call(last_line, entry))).unwrap();

    let TargetState { ref child, ref symbols, ref traces, .. } = *target;
    let mut ret = Some(BreakpointGuard::new(child, child.set_breakpoint(exit)?));
    let mut trace = TraceGuard::guard(child, &traces[&entry]);
    trace.enable_all()?;

    let mut last_line = symbols.line_from_address(entry).map(|(line, _)| line.line).unwrap_or(0);
    let mut last_breakpoint = None;
    let mut attached = false;
    let mut cancelled = false;
    loop {
        let mut event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            // per-line breakpoints

            Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
                state.threads[&event.thread_id] == thread && trace.contains_key(&address)
            => {
                let breakpoint = trace[&address].borrow_mut().take().unwrap();

                state.event = Some(event);
                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // disable and save the breakpoint
                child.remove_breakpoint(breakpoint)?;
                last_breakpoint = Some(address);

                // restart the instruction and enable singlestep
                context.set_instruction_pointer(address);
                context.set_singlestep(true);

                // collect locals

                let frame = symbols.walk_stack(thread)?.next().unwrap();
                let instruction = frame.stack.AddrPC.Offset as usize;
                let (line, _) = symbols.line_from_address(instruction)?;

                let mut locals = vec![];
                symbols.enumerate_locals(instruction, |symbol, size| {
                    if size == 0 { return true; }

                    if let Ok(value) = debug::Value::read(child, &context, symbols, &symbol) {
                        if value.data[0] == 0xcc {
                            return true;
                        }

                        let name = symbol.name.to_string_lossy().into();
                        locals.push((name, format!("{}", value.display(symbols))));
                    }

                    true
                })?;

                tx.send(DebugMessage::Trace(DebugTrace::Line(last_line, locals))).unwrap();
                last_line = line.line;

                debug::set_thread_context(thread, &context)?;
                event = state.event.take().unwrap();
            }

            Exception { first_chance: true, code: winapi::EXCEPTION_SINGLE_STEP, .. } if
                state.threads[&event.thread_id] == thread && last_breakpoint.is_some()
            => {
                let address = last_breakpoint.take().unwrap();

                state.event = Some(event);
                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // resume normal execution
                *trace[&address].borrow_mut() = Some(child.set_breakpoint(address)?);
                context.set_singlestep(false);

                debug::set_thread_context(thread, &context)?;
                event = state.event.take().unwrap();
            }

            // function return breakpoint

            Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
                state.threads[&event.thread_id] == thread && address == exit && ret.is_some()
            => {
                let breakpoint = ret.take().unwrap();

                state.event = Some(event);
                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // disable and save the breakpoint
                let breakpoint = breakpoint.into_inner();
                child.remove_breakpoint(breakpoint)?;

                // restart the instruction and enable singlestep
                context.set_instruction_pointer(address);
                context.set_singlestep(true);

                // if the stack pointer has been restored, we're done
                if context.stack_pointer() == stack {
                    // collect the return value
                    let (value, restore) = call.teardown(child, &context, symbols)?;
                    let value = format!("{}", value.display(symbols));
                    tx.send(DebugMessage::Trace(DebugTrace::Return(last_line, value))).unwrap();

                    if let Some(context) = restore {
                        debug::set_thread_context(thread, &context)?;
                    } else {
                        context.set_singlestep(false);
                        debug::set_thread_context(thread, &context)?;
                    }
                    return Ok(None);
                }

                debug::set_thread_context(thread, &context)?;
                event = state.event.take().unwrap();
            }

            Exception { first_chance: true, code: winapi::EXCEPTION_SINGLE_STEP, .. } if
                state.threads[&event.thread_id] == thread && ret.is_none()
            => {
                state.event = Some(event);
                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // resume normal execution
                ret = Some(BreakpointGuard::new(child, child.set_breakpoint(exit)?));
                context.set_singlestep(false);

                debug::set_thread_context(thread, &context)?;
                event = state.event.take().unwrap();
            }

            // recursive calls and other events

            _ => {
                state.event = Some(event);

                let mut trace_event = trace_default(
                    target, state, tx, &cancel, Some(thread), &mut attached, false
                )?;

                if let Some(TraceEvent::Call(ex @ ExecutionState::Function { .. })) = trace_event {
                    event = state.event.take().unwrap();
                    event.continue_event(true)?;

                    let breakpoint = ret.take().unwrap();
                    child.remove_breakpoint(breakpoint.into_inner())?;

                    trace_event = trace_function(target, state, tx, cancel, ex, last_line)?;
                    ret = Some(BreakpointGuard::new(child, child.set_breakpoint(exit)?));
                }

                if let Some(TraceEvent::Exception) = trace_event {
                    event = state.event.take().unwrap();
                    event.continue_event(false)?;

                    continue;
                }

                if let Some(TraceEvent::Cancel) = trace_event {
                    cancelled = true;
                }

                if let Some(TraceEvent::Terminate) = trace_event {
                    return Ok(trace_event);
                }

                event = state.event.take().unwrap();
            }
        }

        if cancelled && last_breakpoint.is_none() && state.last_call.is_none() {
            state.event = Some(event);

            let restore = call.cancel();
            if let Some(context) = restore {
                debug::set_thread_context(thread, &context)?;
            }

            return Ok(Some(TraceEvent::Cancel));
        }

        event.continue_event(true)?;
    }
}

fn trace_default(
    target: &TargetState, state: &mut DebugState,
    tx: &SyncSender<DebugMessage>, cancel: &AtomicBool,
    current_thread: Option<RawHandle>, capture_calls: &mut bool, startup: bool
) -> io::Result<Option<TraceEvent>> {
    let TargetState { ref child, ref symbols, ref breakpoints, .. } = *target;
    let DebugState { ref mut threads, .. } = *state;

    let event = state.event.as_ref().unwrap();

    use debug::EventInfo::*;
    match event.info {
        ExitProcess { exit_code } => {
            tx.send(DebugMessage::Trace(DebugTrace::Exit(exit_code))).unwrap();
            return Ok(Some(TraceEvent::Terminate));
        }

        CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
        ExitThread { .. } => { threads.remove(&event.thread_id); }

        LoadDll { ref file, base } => {
            let _ = file.as_ref().ok_or(io::Error::from(io::ErrorKind::Other))
                .and_then(|file| symbols.load_module(file, base));
        }
        UnloadDll { base } => { let _ = symbols.unload_module(base); }

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, .. } if startup => {
            return Ok(Some(TraceEvent::Attach));
        }

        // function call breakpoints

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
            current_thread.map(|t| threads[&event.thread_id] == t).unwrap_or(true) &&
            breakpoints.contains_key(&address) && *capture_calls
        => {
            let thread = threads[&event.thread_id];
            let (function, _) = symbols.symbol_from_address(address)?;

            // restart the instruction
            let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;
            context.set_instruction_pointer(address);
            debug::set_thread_context(thread, &context)?;

            let mut frames = symbols.walk_stack(thread)?;
            let callee = frames.next().unwrap();
            let caller = frames.next().unwrap();

            // collect location data
            let entry = address;
            let exit = callee.stack.AddrReturn.Offset as usize;
            let stack = caller.stack.AddrStack.Offset as usize;

            // capture the call
            let call = debug::Call::capture(symbols, &function)?;

            // move to a new execution
            let execution = ExecutionState::Function { call, thread, entry, exit, stack };
            return Ok(Some(TraceEvent::Call(execution)));
        }

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
            current_thread.map(|t| threads[&event.thread_id] == t).unwrap_or(true) &&
            breakpoints.contains_key(&address)
        => {
            let thread = threads[&event.thread_id];
            let breakpoint = breakpoints[&address].borrow_mut().take().unwrap();

            let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

            // disable and save the breakpoint
            child.remove_breakpoint(breakpoint)?;
            state.last_call = Some(address);

            // restart the instruction and enable singlestep
            context.set_instruction_pointer(address);
            context.set_singlestep(true);

            debug::set_thread_context(thread, &context)?;
        }

        Exception { first_chance: true, code: winapi::EXCEPTION_SINGLE_STEP, .. } if
            current_thread.map(|t| threads[&event.thread_id] == t).unwrap_or(true) &&
            state.last_call.is_some()
        => {
            let thread = threads[&event.thread_id];
            let address = state.last_call.take().unwrap();

            let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

            // resume normal execution
            *breakpoints[&address].borrow_mut() = Some(child.set_breakpoint(address)?);
            context.set_singlestep(false);
            *capture_calls = true;

            debug::set_thread_context(thread, &context)?;
        }

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
            breakpoints.contains_key(&address)
        => {
            let message = "unsupported concurrent execution of breakpointed function";
            return Err(io::Error::new(io::ErrorKind::Other, message));
        }

        // cancellation

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, .. } if
            cancel.load(Ordering::Relaxed)
        => {
            cancel.store(false, Ordering::Relaxed);
            tx.send(DebugMessage::Trace(DebugTrace::Cancel)).unwrap();
            return Ok(Some(TraceEvent::Cancel));
        }

        // crashes

        Exception { first_chance: true, .. } => {
            return Ok(Some(TraceEvent::Exception));
        }

        // TODO: collect stack trace
        Exception { first_chance: false, code, address } => {
            let message = format!("unhandled exception 0x{:x} at 0x{:x}", code, address);
            tx.send(DebugMessage::Trace(DebugTrace::Crash(message))).unwrap();
            return Ok(Some(TraceEvent::Terminate));
        }

        _ => {}
    }

    Ok(None)
}
