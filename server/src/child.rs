use std::{io, ptr};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::{sync_channel, SyncSender, Receiver};
use std::thread;
use std::thread::JoinHandle;
use std::os::windows::io::AsRawHandle;

use debug;

use winapi;
use kernel32;

pub struct Thread {
    pub thread: JoinHandle<()>,
    pub tx: SyncSender<ServerMessage>,
    pub rx: Receiver<DebugMessage>,
}

/// messages the debug event loop sends to the server
pub enum DebugMessage {
    Attached,
    Breakpoint,
    Executing,
    Trace(DebugTrace),
    Error(io::Error),
}

pub enum DebugTrace {
    Line(u32, Vec<(String, u64)>),
    Terminated,
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
        let (server_tx, server_rx) = sync_channel(0);
        let (debug_tx, debug_rx) = sync_channel(0);

        let thread = thread::spawn(move || {
            if let Err(e) = run(path, debug_tx.clone(), server_rx) {
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

    threads: HashMap<winapi::DWORD, winapi::HANDLE>,
    breakpoints: HashMap<usize, Option<debug::Breakpoint>>,
    last_breakpoint: Option<usize>,
}

fn run(path: PathBuf, tx: SyncSender<DebugMessage>, rx: Receiver<ServerMessage>) -> io::Result<()> {
    let child = debug::Command::new(&path)
        .env_clear()
        .debug()?;

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let symbols = debug::SymbolHandler::initialize(child.as_raw_handle())?;

    let mut state = DebugState {
        child: child,
        symbols: symbols,
        attached: false,

        threads: HashMap::new(),
        breakpoints: HashMap::new(),
        last_breakpoint: None,
    };

    let event = debug::DebugEvent::wait_event()?;
    if let debug::DebugEventInfo::CreateProcess(cp) = event.info {
        state.symbols.load_module(cp.hFile, cp.lpBaseOfImage as usize)?;
        state.threads.insert(event.thread_id, cp.hThread);
        if cp.hFile != ptr::null_mut() {
            unsafe { kernel32::CloseHandle(cp.hFile) };
        }

        tx.send(DebugMessage::Attached).unwrap();
    } else {
        panic!("got another debug event before CreateProcess");
    }

    let mut event = Some(event);
    loop {
        match rx.recv().unwrap() {
            ServerMessage::ListFunctions => {}
            ServerMessage::DescribeFunction { .. } => {}
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

fn trace_function(
    state: &mut DebugState, tx: &SyncSender<DebugMessage>
) -> io::Result<debug::DebugEvent> {
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
        let event = debug::DebugEvent::wait_event()?;

        use debug::DebugEventInfo::*;
        match event.info {
            ExitProcess(_ep) => {
                tx.send(DebugMessage::Trace(DebugTrace::Terminated)).unwrap();
                return Ok(event);
            }

            CreateThread(ct) => { threads.insert(event.thread_id, ct.hThread); }
            ExitThread(..) => { threads.remove(&event.thread_id); }

            LoadDll(ld) => {
                symbols.load_module(ld.hFile, ld.lpBaseOfDll as usize)?;
                if ld.hFile != ptr::null_mut() {
                    unsafe { kernel32::CloseHandle(ld.hFile) };
                }
            }
            UnloadDll(ud) => {
                symbols.unload_module(ud.lpBaseOfDll as usize)?;
            }

            Exception(e) => {
                let ref er = e.ExceptionRecord;
                let thread = threads[&event.thread_id];

                if !*attached {
                    *attached = true;
                } else if er.ExceptionCode == winapi::EXCEPTION_BREAKPOINT {
                    // disable and save the breakpoint
                    let address = er.ExceptionAddress as usize;
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
                    symbols.enumerate_symbols(instruction, |symbol, size| {
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
                } else if er.ExceptionCode == winapi::EXCEPTION_SINGLE_STEP {
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
