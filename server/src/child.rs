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

// TODO: remove this once these messages are used
#[allow(dead_code)]
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
}

struct DebugState {
    threads: HashMap<winapi::DWORD, RawHandle>,
    breakpoints: HashMap<usize, Option<debug::Breakpoint>>,

    execution: Option<ExecutionState>,
    event: Option<debug::Event>,
    attached: bool,
    last_call: Option<usize>,
}

enum ExecutionState {
    Process,

    Function {
        call: debug::Call,
        trace: HashMap<usize, Option<debug::Breakpoint>>,
        attached: bool,

        line: u32,
        entry: usize,
        exit: usize,
    },
}

fn run(
    child: debug::Child, tx: SyncSender<DebugMessage>, rx: Receiver<ServerMessage>
) -> io::Result<()> {
    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let symbols = debug::SymbolHandler::initialize(&child)?;

    let target = TargetState {
        child: child,
        symbols: symbols,
    };

    let mut state = DebugState {
        threads: HashMap::new(),
        breakpoints: HashMap::new(),

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
                let breakpoints = state.breakpoints.keys().cloned().collect();
                let message = DebugMessage::Breakpoints(breakpoints);
                tx.send(message).unwrap();
            }

            ServerMessage::SetBreakpoint { address } => {
                let message = set_breakpoint(&target, &mut state, address)
                    .map(|()| DebugMessage::Breakpoint)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::ClearBreakpoint { address } => {
                let message = remove_breakpoint(&target, &mut state, address)
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
                let message = call_function(&target, &mut state, address, arguments)
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
                        trace_function(&target, &mut state, &tx, ex)
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

fn set_breakpoint(target: &TargetState, state: &mut DebugState, address: usize) -> io::Result<()> {
    let TargetState { ref child, ref symbols } = *target;
    let DebugState { ref mut breakpoints, .. } = *state;

    let (function, offset) = symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    if breakpoints.contains_key(&function.address) {
        return Ok(());
    }

    let breakpoint = child.set_breakpoint(function.address)?;
    breakpoints.insert(function.address, Some(breakpoint));

    Ok(())
}

fn remove_breakpoint(
    target: &TargetState, state: &mut DebugState, address: usize
) -> io::Result<()> {
    let TargetState { ref child, .. } = *target;
    let DebugState { ref mut breakpoints, .. } = *state;

    let breakpoint = breakpoints.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::NotFound, "no such breakpoint"))?
        .ok_or(io::Error::new(io::ErrorKind::Other, "breakpoint temporarily disabled"))?;
    child.remove_breakpoint(breakpoint)?;

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
    target: &TargetState, state: &mut DebugState, address: usize, arguments: Vec<i32>
) -> io::Result<()> {
    let mut event = state.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    let TargetState { ref child, ref symbols } = *target;
    let thread = state.threads[&event.thread_id];
    let (function, offset) = symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    state.event = Some(event);
    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

    set_breakpoint(target, state, address)?;

    // set up the call
    let arg_type = debug::Type::Base { base: debug::Primitive::Int { signed: true }, size: 4 };
    let args: Vec<_> = arguments.into_iter()
        .map(|arg| debug::Value::new(arg, arg_type.clone()))
        .collect();
    let exit = context.instruction_pointer();
    let call = debug::Call::setup(child, symbols, &mut context, &function, args)?;

    // set a breakpoint on each line
    let mut lines = symbols.lines_from_symbol(&function)?;
    let line = lines.next().map(|line| line.line).unwrap_or(0);
    let mut trace = Trace::create(child);
    for line in lines {
        trace.set_breakpoint(line.address)?;
    }
    trace.set_breakpoint(exit)?;

    debug::set_thread_context(thread, &context)?;
    event = state.event.take().unwrap();

    // move to a new execution
    let trace = trace.pause();
    let attached = false;
    let entry = address;
    state.execution = Some(ExecutionState::Function { call, trace, attached, line, entry, exit });

    event.continue_event(true)?;
    Ok(())
}

fn trace_function(
    target: &TargetState, state: &mut DebugState, tx: &SyncSender<DebugMessage>,
    execution: ExecutionState
) -> io::Result<()> {
    let (call, trace, mut attached, line, address, exit) = match execution {
        ExecutionState::Function { call, trace, attached, line, entry, exit } =>
            (call, trace, attached, line, entry, exit),
        _ => unreachable!(),
    };
    tx.send(DebugMessage::Trace(DebugTrace::Call(line, address))).unwrap();

    let TargetState { ref child, ref symbols } = *target;
    let mut trace = Trace::resume(child, trace);

    let mut last_line = line;
    let mut last_breakpoint = None;
    loop {
        let mut event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
                state.attached && trace.has_breakpoint(address) && address != exit
            => {
                let thread = state.threads[&event.thread_id];
                let breakpoint = trace.take_breakpoint(address).unwrap();

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
                trace.set_breakpoint(address)?;
                context.set_singlestep(false);

                debug::set_thread_context(thread, &context)?;
                event = state.event.take().unwrap();
            }

            Exception { first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address } if
                state.attached && address == exit
            => {
                let thread = state.threads[&event.thread_id];

                state.event = Some(event);
                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // restart the instruction
                context.set_instruction_pointer(address);

                // collect the return value
                let (value, restore) = call.teardown(child, &context, symbols)?;
                let value = format!("{}", value.display(symbols));
                tx.send(DebugMessage::Trace(DebugTrace::Return(last_line, value))).unwrap();

                if let Some(context) = restore {
                    debug::set_thread_context(thread, &context)?;
                } else {
                    debug::set_thread_context(thread, &context)?;
                }
                return Ok(());
            }

            _ => {
                state.event = Some(event);
                match trace_default(target, state, tx, &mut attached)? {
                    Some(TraceEvent::Call(ex @ ExecutionState::Function { .. })) => {
                        event = state.event.take().unwrap();
                        event.continue_event(true)?;
                        trace_function(target, state, tx, ex)?;
                    }

                    Some(TraceEvent::Terminate) => { return Ok(()); }
                    None => {}
                    _ => unreachable!(),
                }
                event = state.event.take().unwrap();
            }
        }

        event.continue_event(true)?;
    }
}

enum TraceEvent {
    Call(ExecutionState),
    Terminate,
}

fn trace_default(
    target: &TargetState, state: &mut DebugState, tx: &SyncSender<DebugMessage>,
    capture_calls: &mut bool
) -> io::Result<Option<TraceEvent>> {
    let TargetState { ref child, ref symbols } = *target;
    let DebugState { ref mut threads, ref mut breakpoints, ref mut attached, .. } = *state;

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
            let breakpoint = breakpoints.get_mut(&address).and_then(Option::take).unwrap();

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
            let breakpoint = child.set_breakpoint(address)?;
            breakpoints.insert(address, Some(breakpoint));
            context.set_singlestep(false);

            debug::set_thread_context(thread, &context)?;

            // if this is a function-level breakpoint and we came from call_function, we're done
            if !*capture_calls {
                *capture_calls = true;
                return Ok(None);
            }

            // capture the call
            let frame = symbols.walk_stack(thread)?.next().unwrap();
            let exit = frame.stack.AddrReturn.Offset as usize;
            let call = debug::Call::capture(symbols, &function)?;

            // set a breakpoint on each line
            let mut lines = symbols.lines_from_symbol(&function)?;
            let line = lines.next().map(|line| line.line).unwrap_or(0);
            let mut trace = Trace::create(child);
            for line in lines {
                trace.set_breakpoint(line.address)?;
            }
            trace.set_breakpoint(exit)?;

            // move to a new execution
            let trace = trace.pause();
            let attached = true;
            let entry = address;
            let execution = ExecutionState::Function { call, trace, attached, line, entry, exit };
            return Ok(Some(TraceEvent::Call(execution)));
        }

        _ => {}
    }

    Ok(None)
}
