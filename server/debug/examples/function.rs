extern crate debug;

extern crate winapi;
extern crate kernel32;

use std::{env, ptr};
use std::collections::HashMap;
use std::os::windows::io::AsRawHandle;

fn main() {
    let child = debug::Command::new(env::args().nth(1).unwrap())
        .env_clear()
        .debug()
        .expect("failed to launch process");
    let function_name = env::args().nth(2).unwrap();

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let mut symbols = debug::SymbolHandler::initialize(child.as_raw_handle())
        .expect("failed to initialize symbol handler");

    let mut attached = false;

    let mut done = false;
    while !done {
        let event = debug::DebugEvent::wait_event()
            .expect("failed to get debug event");

        let mut debug_continue = false;

        use debug::DebugEventInfo::*;
        match event.info {
            // FIXME: currently this ignores cp.hProcess and thus only supports a single child
            CreateProcess(cp) => {
                threads.insert(event.thread_id, cp.hThread);

                symbols.load_module(cp.hFile, cp.lpBaseOfImage as usize)
                    .expect("failed to load module");

                if cp.hFile != ptr::null_mut() {
                    unsafe { kernel32::CloseHandle(cp.hFile) };
                }
            }
            ExitProcess(..) => { done = true; }

            CreateThread(ct) => { threads.insert(event.thread_id, ct.hThread); }
            ExitThread(..) => { threads.remove(&event.thread_id); }

            LoadDll(ld) => {
                symbols.load_module(ld.hFile, ld.lpBaseOfDll as usize)
                    .expect("failed to load module");

                if ld.hFile != ptr::null_mut() {
                    unsafe { kernel32::CloseHandle(ld.hFile) };
                }
            }
            UnloadDll(ud) => { let _ = symbols.unload_module(ud.lpBaseOfDll as usize); }

            OutputDebugString(ds) => {
                let mut buffer = vec![0u8; ds.nDebugStringLength as usize];
                child.read_memory(ds.lpDebugStringData as usize, &mut buffer)
                    .expect("failed reading debug string");

                let string = String::from_utf8_lossy(&buffer);
                println!("{}", string);
            }

            Exception(e) => {
                let er = &e.ExceptionRecord;

                if !attached {
                    attached = true;

                    print!("{}(", function_name);
                    let function = symbols.symbol_from_name(&function_name)
                        .expect("failed to get symbol");

                    let thread = threads[&event.thread_id];
                    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)
                        .expect("failed to get context");
                    context.Rip = function.address as winapi::DWORD64;
                    debug::set_thread_context(thread, &context)
                        .expect("failed to set context");

                    symbols.enumerate_symbols(function.address, |symbol, _| {
                        if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
                            print!("{},", symbol.name.to_string_lossy());
                        }
                        true
                    }).expect("failed to enumerate symbols");
                    println!(");");

                    debug_continue = true;
                } else if e.dwFirstChance == 0 {
                    println!("passing on last chance exception");
                } else {
                    if er.ExceptionCode == winapi::EXCEPTION_BREAKPOINT {
                        debug_continue = true;
                    }

                    let frame = symbols.walk_stack(threads[&event.thread_id])
                        .expect("failed to get thread stack")
                        .nth(0)
                        .expect("failed to get stack frame");
                    let ref context = frame.context;
                    let ref stack = frame.stack;

                    let address = stack.AddrPC.Offset as usize;
                    let (symbol, off) = symbols.symbol_from_address(address)
                        .expect("failed to get symbol");

                    let file_pos = symbols.line_from_address(address)
                        .map(|(file, line, _off)| {
                            format!("{}:{}", file.to_string_lossy(), line)
                        })
                        .unwrap_or(String::new());

                    let name = symbol.name.to_string_lossy();
                    println!(
                        "exception {:#x} at 0x{:016x} {}+{} {}",
                        er.ExceptionCode, address, name, off, file_pos
                    );

                    let instruction = stack.AddrPC.Offset as usize;
                    symbols.enumerate_symbols(instruction, |symbol, size| {
                        if size == 0 { return true; }

                        let name = symbol.name.to_string_lossy();

                        let mut buffer = vec![0u8; size];
                        let address = context.Rbp as usize + symbol.address;
                        match child.read_memory(address, &mut buffer) {
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
                    }).expect("failed to enumerate symbols");
                }
            }

            Rip(..) => println!("rip event"),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
