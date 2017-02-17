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
    threads: HashMap<winapi::DWORD, RawHandle>,
    breakpoints: HashMap<usize, Option<debug::Breakpoint>>,
}

struct TraceState {
    execution: Option<ExecutionState>,
    event: Option<debug::Event>,
    attached: bool,
}

enum ExecutionState {
    Process,

    Function {
        trace: HashMap<usize, Option<debug::Breakpoint>>,
        line: u32,
        exit: usize,
        call: debug::Call,
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
        threads: HashMap::new(),
        breakpoints: HashMap::new(),
    };

    let event = debug::Event::wait_event()?;
    if let debug::EventInfo::CreateProcess { ref file, main_thread, base, .. } = event.info {
        let _ = file.as_ref()
            .ok_or(io::Error::new(io::ErrorKind::Other, "no file handle for CreateProcess"))
            .and_then(|file| target.symbols.load_module(file, base));

        target.threads.insert(event.thread_id, main_thread);
        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }

    let mut trace = TraceState {
        execution: None,
        event: Some(event),
        attached: false,
    };

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
                let message = continue_process(&mut trace)
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::CallFunction { address, arguments } => {
                let message = call_function(&mut target, &mut trace, address, arguments)
                    .map(|()| DebugMessage::Executing)
                    .unwrap_or_else(DebugMessage::Error);
                tx.send(message).unwrap();
            }

            ServerMessage::Trace => {
                assert!(trace.event.is_none());

                let result = match trace.execution.take() {
                    Some(ex @ ExecutionState::Process) => {
                        trace_process(&mut target, &mut trace, &tx, ex)
                    }

                    Some(ex @ ExecutionState::Function { .. }) => {
                        trace_function(&mut target, &mut trace, &tx, ex)
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
    let TargetState { ref mut child, ref symbols, ref mut breakpoints, .. } = *target;

    let (function, offset) = symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    let breakpoint = child.set_breakpoint(function.address)?;
    breakpoints.insert(address, Some(breakpoint));

    Ok(())
}

fn remove_breakpoint(target: &mut TargetState, address: usize) -> io::Result<()> {
    let TargetState { ref mut child, ref mut breakpoints, .. } = *target;

    let breakpoint = breakpoints.remove(&address)
        .ok_or(io::Error::new(io::ErrorKind::NotFound, "no such breakpoint"))?
        .ok_or(io::Error::new(io::ErrorKind::Other, "breakpoint temporarily disabled"))?;
    child.remove_breakpoint(breakpoint)?;

    Ok(())
}

fn continue_process(trace: &mut TraceState) -> io::Result<()> {
    let event = trace.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    trace.execution = Some(ExecutionState::Process);

    event.continue_event(true)?;
    Ok(())
}

fn trace_process(
    target: &mut TargetState, trace: &mut TraceState, tx: &SyncSender<DebugMessage>,
    execution: ExecutionState
) -> io::Result<()> {
    let _ = match execution {
        ExecutionState::Process => (),
        _ => unreachable!(),
    };

    let mut last_breakpoint = None;
    loop {
        let mut event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            Exception {
                first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address
            } if trace.attached => {
                let TargetState { ref mut child, ref threads, ref mut breakpoints, ..  } = *target;
                let thread = threads[&event.thread_id];
                let breakpoint = match breakpoints.get_mut(&address).and_then(Option::take) {
                    Some(breakpoint) => breakpoint,
                    None => { event.continue_event(false)?; continue; }
                };

                let TraceState { event: ref mut trace_event, .. } = *trace;
                *trace_event = Some(event);

                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // disable and save the breakpoint
                child.remove_breakpoint(breakpoint)?;
                last_breakpoint = Some(address);

                // restart the instruction and enable singlestep
                context.set_instruction_pointer(address);
                context.set_singlestep(true);

                debug::set_thread_context(thread, &context)?;
                event = trace_event.take().unwrap();
            }

            Exception {
                first_chance: true, code: winapi::EXCEPTION_SINGLE_STEP, ..
            } if trace.attached => {
                let TargetState { ref mut child, ref symbols, ref mut breakpoints, .. } = *target;
                let thread = target.threads[&event.thread_id];
                let address = match last_breakpoint.take() {
                    Some(address) => address,
                    None => { event.continue_event(false)?; continue }
                };
                let (function, _) = symbols.symbol_from_address(address)?;

                let TraceState { ref mut execution, event: ref mut trace_event, .. } = *trace;
                *trace_event = Some(event);

                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // resume normal execution
                let breakpoint = child.set_breakpoint(address)?;
                breakpoints.insert(address, Some(breakpoint));
                context.set_singlestep(false);

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
                debug::set_thread_context(thread, &context)?;
                let trace = trace.commit();
                *execution = Some(ExecutionState::Function { trace, line, exit, call });
                tx.send(DebugMessage::Trace(DebugTrace::Breakpoint(address))).unwrap();

                event = trace_event.take().unwrap();
                event.continue_event(true)?;
                return Ok(());
            }

            _ => if trace_event(&mut target.symbols, &mut target.threads, trace, tx, &event) {
                return Ok(())
            },
        }

        event.continue_event(true)?;
    }
}

fn call_function(
    target: &mut TargetState, trace: &mut TraceState, address: usize, arguments: Vec<i32>
) -> io::Result<()> {
    let mut event = trace.event.take()
        .ok_or(io::Error::new(io::ErrorKind::AlreadyExists, "process already running"))?;

    let TargetState { ref mut child, ref mut symbols, ref threads, .. } = *target;
    let thread = threads[&event.thread_id];
    let (function, offset) = symbols.symbol_from_address(address)?;
    if offset > 0 {
        return Err(io::Error::new(io::ErrorKind::NotFound, "no such function"));
    }

    let TraceState { ref mut execution, event: ref mut trace_event, .. } = *trace;
    *trace_event = Some(event);

    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

    // set up the call
    let arg_type = debug::Type::Base { base: debug::Primitive::Int { signed: true }, size: 4 };
    let args: Vec<_> = arguments.into_iter()
        .map(|arg| debug::Value::new(arg, arg_type.clone()))
        .collect();
    let exit = context.instruction_pointer();
    let call = debug::Call::setup(child, &mut context, &symbols, &function, args)?;

    // set a breakpoint on each line
    let mut lines = symbols.lines_from_symbol(&function)?;
    let line = lines.next().map(|line| line.line).unwrap_or(0);
    let mut trace = Trace::create(child);
    for line in lines {
        trace.set_breakpoint(line.address)?;
    }
    trace.set_breakpoint(exit)?;

    // move to a new execution
    debug::set_thread_context(thread, &context)?;
    let trace = trace.commit();
    *execution = Some(ExecutionState::Function { trace, line, exit, call });

    event = trace_event.take().unwrap();
    event.continue_event(true)?;
    Ok(())
}

fn trace_function(
    target: &mut TargetState, trace: &mut TraceState, tx: &SyncSender<DebugMessage>,
    execution: ExecutionState
) -> io::Result<()> {
    let (breakpoints, line, exit, call) = match execution {
        ExecutionState::Function { trace, line, exit, call } => (trace, line, exit, call),
        _ => unreachable!(),
    };
    let mut breakpoints = Trace::resume(&mut target.child, breakpoints);

    let mut last_line = line;
    let mut last_breakpoint = None;
    loop {
        let mut event = debug::Event::wait_event()?;

        use debug::EventInfo::*;
        match event.info {
            Exception {
                first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address
            } if trace.attached && address != exit => {
                let TargetState { ref mut symbols, ref threads, ..  } = *target;
                let thread = threads[&event.thread_id];
                let breakpoint = match breakpoints.take_breakpoint(address) {
                    Some(breakpoint) => breakpoint,
                    None => { event.continue_event(false)?; continue; }
                };

                let TraceState { event: ref mut trace_event, .. } = *trace;
                *trace_event = Some(event);

                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // disable and save the breakpoint
                breakpoints.remove_breakpoint(breakpoint)?;
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

                    let child = breakpoints.child();
                    if let Ok(value) = debug::Value::read(child, &context, &symbols, &symbol) {
                        if value.data[0] == 0xcc {
                            return true;
                        }

                        let name = symbol.name.to_string_lossy().into();
                        locals.push((name, format!("{}", value.display(&symbols))));
                    }

                    true
                })?;

                tx.send(DebugMessage::Trace(DebugTrace::Line(last_line, locals))).unwrap();
                last_line = line.line;

                // move to the next line
                debug::set_thread_context(thread, &context)?;
                event = trace_event.take().unwrap();
            }

            Exception {
                first_chance: true, code: winapi::EXCEPTION_SINGLE_STEP, ..
            } if trace.attached => {
                let TargetState { ref threads, .. } = *target;
                let thread = threads[&event.thread_id];
                let address = match last_breakpoint.take() {
                    Some(address) => address,
                    None => { event.continue_event(false)?; continue; }
                };

                let TraceState { event: ref mut trace_event, .. } = *trace;
                *trace_event = Some(event);

                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // resume normal execution
                breakpoints.set_breakpoint(address)?;
                context.set_singlestep(false);

                debug::set_thread_context(thread, &context)?;

                event = trace_event.take().unwrap();
            }

            Exception {
                first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, address
            } if trace.attached && address == exit => {
                let TargetState { ref symbols, ref threads, .. } = *target;
                let thread = threads[&event.thread_id];

                let TraceState { event: ref mut trace_event, .. } = *trace;
                *trace_event = Some(event);

                let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)?;

                // restart the instruction
                context.set_instruction_pointer(address);

                // collect the return value
                let (value, restore) = call.teardown(breakpoints.child(), &context, &symbols)?;
                let value = format!("{}", value.display(&symbols));
                tx.send(DebugMessage::Trace(DebugTrace::Return(last_line, value))).unwrap();

                if let Some(context) = restore {
                    debug::set_thread_context(thread, &context)?;
                } else {
                    debug::set_thread_context(thread, &context)?;
                }
                return Ok(());
            }

            _ => if trace_event(&mut target.symbols, &mut target.threads, trace, tx, &event) {
                return Ok(());
            }
        }

        event.continue_event(true)?;
    }
}

fn trace_event(
    symbols: &mut debug::SymbolHandler, threads: &mut HashMap<winapi::DWORD, RawHandle>,
    trace: &mut TraceState, tx: &SyncSender<DebugMessage>,
    event: &debug::Event
) -> bool {
    let TraceState { ref mut attached, .. } = *trace;

    use debug::EventInfo::*;
    match event.info {
        ExitProcess { exit_code } => {
            let trace = DebugTrace::Exit(exit_code);
            tx.send(DebugMessage::Trace(trace)).unwrap();
            return true;
        }

        CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
        ExitThread { .. } => { threads.remove(&event.thread_id); }

        LoadDll { ref file, base } => {
            let _ = file.as_ref().ok_or(io::Error::from(io::ErrorKind::Other))
                .and_then(|file| symbols.load_module(file, base));
        }
        UnloadDll { base } => { let _ = symbols.unload_module(base); }

        Exception {
            first_chance: true, code: winapi::EXCEPTION_BREAKPOINT, ..
        } if !*attached => {
            *attached = true;
        }

        _ => {}
    }

    false
}
