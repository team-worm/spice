extern crate debug;

extern crate winapi;
extern crate kernel32;

use std::{env, mem, ptr};
use std::collections::HashMap;
use std::os::windows::io::AsRawHandle;

fn main() {
    let child = debug::Command::new(env::args().nth(1).unwrap())
        .env_clear()
        .debug()
        .expect("failed to launch process");

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

                let address = unsafe { mem::transmute(cp.lpStartAddress) };
                let (symbol, off) = symbols.symbol_from_address(address)
                    .expect("failed to get symbol");

                let name = symbol.name.to_string_lossy();
                println!("create process: {} {}+{}", event.process_id, name, off);

                if cp.hFile != ptr::null_mut() {
                    unsafe { kernel32::CloseHandle(cp.hFile) };
                }
            }

            ExitProcess(ep) => {
                println!("exit process: {} ({})", event.process_id, ep.dwExitCode);
                done = true;
            }

            CreateThread(ct) => {
                println!(
                    "create thread: {} {:#018x}",
                    event.thread_id, unsafe { mem::transmute::<_, usize>(ct.lpStartAddress) }
                );

                threads.insert(event.thread_id, ct.hThread);
            }

            ExitThread(et) => {
                println!("exit thread: {} ({})", event.thread_id, et.dwExitCode);

                threads.remove(&event.thread_id);
            }

            LoadDll(ld) => {
                println!("load dll: {:#018x}", ld.lpBaseOfDll as usize);

                symbols.load_module(ld.hFile, ld.lpBaseOfDll as usize)
                    .expect("failed to load module");

                if ld.hFile != ptr::null_mut() {
                    unsafe { kernel32::CloseHandle(ld.hFile) };
                }
            }

            UnloadDll(ud) => {
                println!("unload dll: {:#018x}", ud.lpBaseOfDll as usize);

                let _ = symbols.unload_module(ud.lpBaseOfDll as usize);
            }

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
                } else if e.dwFirstChance == 0 {
                    println!("passing on last chance exception");
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
                }
            }

            Rip(..) => println!("rip event"),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
