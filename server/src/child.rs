use std::{io, mem};
use std::collections::HashMap;
use std::path::PathBuf;
use std::ffi::OsString;
use std::sync::mpsc::{sync_channel, SyncSender, Receiver};
use std::thread;
use std::thread::JoinHandle;
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

#[derive(Copy, Clone)]
pub enum Execution {
    Process,
    Function(usize),
}

/// messages the debug event loop sends to the server
pub enum DebugMessage {
    Attached,
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
    Crash,
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
    CallFunction { address: usize, arguments: Vec<i32> },
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

            execution: None,
            id: -1,
        }
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
    attached: bool,
    last_call: Option<usize>,
}

enum ExecutionState {
    Process,

    Function {
        call: debug::Call,
        attached: bool,

        entry: usize,
        exit: usize,
        stack: usize,
    },
}

fn run(
    child: debug::Child, tx: SyncSender<DebugMessage>, rx: Receiver<ServerMessage>
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
        attached: false,
        last_call: None,
    };

    let event = debug::Event::wait_event()?;
    if let debug::EventInfo::CreateProcess { ref file, main_thread, base, .. } = event.info {
        let _ = file.as_ref()
            .ok_or(io::Error::new(io::ErrorKind::Other, "no file handle for CreateProcess"))
            .and_then(|file| target.symbols.load_module(file, base));

        state.threads.insert(event.thread_id, main_thread);
        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }
    state.event = Some(event);

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
                let message = call_function(&mut target, &mut state, address, arguments)
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::Trace => {
                assert!(state.event.is_none());

                let result = match state.execution.take() {
                    Some(ex @ ExecutionState::Process) => {
                        trace_process(&target, &mut state, &tx, ex)
                    }

                    Some(ex @ ExecutionState::Function { .. }) => {
                        trace_function(&target, &mut state, &tx, ex, 0)
                            .map(|_| ())
                    }

                    None => Err(io::Error::from(io::ErrorKind::NotFound)),
                };

                if let Err(e) = result {
                    tx.send(DebugMessage::Error(e)).unwrap();
                }
            }

            ServerMessage::Stop => {}

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

    let mut trace = TraceGuard::new(child);
    for line in symbols.lines_from_symbol(&function)? {
        trace.set_breakpoint(line.address)?;
    }
    let mut trace = trace.into_inner();

    breakpoints.insert(address, trace.remove(&address).unwrap());
    traces.insert(address, trace);

    Ok(())
}

fn remove_breakpoint(target: &mut TargetState, address: usize) -> io::Result<()> {
    let TargetState { ref child, ref mut breakpoints, ref mut traces, .. } = *target;

    let breakpoint = breakpoints.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::NotFound, "no such breakpoint"))?;
    let mut trace = traces.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::Other, "missing function trace"))?;

    trace.insert(address, breakpoint);
    mem::drop(TraceGuard::from_set(child, trace));

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
    target: &TargetState, state: &mut DebugState, tx: &SyncSender<DebugMessage>,
    execution: ExecutionState
) -> io::Result<()> {
    let _ = match execution {
        ExecutionState::Process => (),
        _ => unreachable!(),
    };

    loop {
        let mut event = debug::Event::wait_event()?;

        state.event = Some(event);
        match trace_default(target, state, tx, &mut true)? {
            Some(TraceEvent::Call(ex @ ExecutionState::Function { .. })) => {
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

            Some(TraceEvent::Terminate) => { return Ok(()); }
            None => {}
            _ => unreachable!(),
        }
        event = state.event.take().unwrap();

        event.continue_event(true)?;
    }
}

fn call_function(
    target: &mut TargetState, state: &mut DebugState, address: usize, arguments: Vec<i32>
) -> io::Result<()> {
    let mut event = state.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    let thread = state.threads[&event.thread_id];
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
    let attached = false;

    let stack = context.stack_pointer() + mem::size_of::<usize>();

    debug::set_thread_context(thread, &context)?;
    event = state.event.take().unwrap();

    // move to a new execution
    state.execution = Some(ExecutionState::Function { call, attached, entry, exit, stack });

    event.continue_event(true)?;
    Ok(())
}

enum TraceEvent {
    Call(ExecutionState),
    Terminate,
}

fn trace_function(
    target: &TargetState, state: &mut DebugState, tx: &SyncSender<DebugMessage>,
    execution: ExecutionState, last_line: u32
) -> io::Result<Option<TraceEvent>> {
    let (call, mut attached, entry, exit, stack) = match execution {
        ExecutionState::Function { call, attached, entry, exit, stack } =>
            (call, attached, entry, exit, stack),
        _ => unreachable!(),
    };
    tx.send(DebugMessage::Trace(DebugTrace::Call(last_line, entry))).unwrap();

    let TargetState { ref child, ref symbols, ref traces, .. } = *target;
    let ref trace = traces[&entry];
    let mut ret = Some(BreakpointGuard::new(child, child.set_breakpoint(exit)?));

    let mut last_line = symbols.line_from_address(entry).map(|(line, _)| line.line).unwrap_or(0);
    let mut last_breakpoint = None;
    loop {
        let mut event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            // per-line breakpoints

            Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
                state.attached && trace.contains_key(&address)
            => {
                let thread = state.threads[&event.thread_id];
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
                state.attached && last_breakpoint.is_some()
            => {
                let thread = state.threads[&event.thread_id];
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
                state.attached && address == exit && ret.is_some()
            => {
                let thread = state.threads[&event.thread_id];
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
                state.attached && ret.is_none()
            => {
                let thread = state.threads[&event.thread_id];

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
                match trace_default(target, state, tx, &mut attached)? {
                    Some(TraceEvent::Call(ex @ ExecutionState::Function { .. })) => {
                        event = state.event.take().unwrap();
                        event.continue_event(true)?;

                        let breakpoint = ret.take().unwrap();
                        child.remove_breakpoint(breakpoint.into_inner())?;

                        let event = trace_function(target, state, tx, ex, last_line)?;
                        if let Some(TraceEvent::Terminate) = event {
                            return Ok(event);
                        }

                        ret = Some(BreakpointGuard::new(child, child.set_breakpoint(exit)?));
                    }

                    event @ Some(TraceEvent::Terminate) => { return Ok(event); }
                    None => {}
                    _ => unreachable!(),
                }
                event = state.event.take().unwrap();
            }
        }

        event.continue_event(true)?;
    }
}

fn trace_default(
    target: &TargetState, state: &mut DebugState, tx: &SyncSender<DebugMessage>,
    capture_calls: &mut bool
) -> io::Result<Option<TraceEvent>> {
    let TargetState { ref child, ref symbols, ref breakpoints, .. } = *target;
    let DebugState { ref mut threads, ref mut attached, .. } = *state;

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

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, .. } if
            !*attached
        => {
            *attached = true;
        }

        Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
            *attached && breakpoints.contains_key(&address)
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
            *attached && state.last_call.is_some()
        => {
            let thread = threads[&event.thread_id];
            let address = state.last_call.take().unwrap();
            let (function, _) = symbols.symbol_from_address(address)?;

            let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

            // resume normal execution
            *breakpoints[&address].borrow_mut() = Some(child.set_breakpoint(address)?);
            context.set_singlestep(false);

            debug::set_thread_context(thread, &context)?;

            // if this is a function-level breakpoint and we came from call_function, we're done
            if !*capture_calls {
                *capture_calls = true;
                return Ok(None);
            }

            let mut frames = symbols.walk_stack(thread)?;
            let callee = frames.next().unwrap();
            let caller = frames.next().unwrap();

            // collect location data
            let entry = address;
            let exit = callee.stack.AddrReturn.Offset as usize;
            let stack = caller.stack.AddrStack.Offset as usize;

            // capture the call
            let call = debug::Call::capture(symbols, &function)?;
            let attached = true;

            // move to a new execution
            let execution = ExecutionState::Function { call, attached, entry, exit, stack };
            return Ok(Some(TraceEvent::Call(execution)));
        }

        Exception { first_chance: false, .. } => {
            tx.send(DebugMessage::Trace(DebugTrace::Crash)).unwrap();
            return Ok(Some(TraceEvent::Terminate));
        }

        _ => {}
    }

    Ok(None)
}
