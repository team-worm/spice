extern crate debug;

extern crate winapi;

use std::env;
use std::collections::HashMap;

fn main() {
    let child = debug::Command::new(env::args().nth(1).unwrap())
        .env_clear()
        .debug()
        .expect("failed to launch process");

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let mut symbols = debug::SymbolHandler::initialize(&child)
        .expect("failed to initialize symbol handler");

    let mut attached = false;

    let mut done = false;
    while !done {
        let event = debug::Event::wait_event()
            .expect("failed to get debug event");

        let mut debug_continue = false;

        use debug::EventInfo::*;
        match event.info {
            // FIXME: currently this ignores cp.hProcess and thus only supports a single child
            CreateProcess { ref file, main_thread, base, start_address, .. } => {
                threads.insert(event.thread_id, main_thread);

                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");

                let (symbol, off) = symbols.symbol_from_address(start_address)
                    .expect("failed to get symbol");

                let name = symbol.name.to_string_lossy();
                println!("create process: {} {}+{}", event.process_id, name, off);
            }

            ExitProcess { exit_code } => {
                println!("exit process: {} ({})", event.process_id, exit_code);
                done = true;
            }

            CreateThread { thread, start_address } => {
                println!("create thread: {} {:#018x}", event.thread_id, start_address);

                threads.insert(event.thread_id, thread);
            }

            ExitThread { exit_code } => {
                println!("exit thread: {} ({})", event.thread_id, exit_code);

                threads.remove(&event.thread_id);
            }

            LoadDll { ref file, base } => {
                println!("load dll: {:#018x}", base);

                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");
            }

            UnloadDll { base } => {
                println!("unload dll: {:#018x}", base);

                let _ = symbols.unload_module(base);
            }

            OutputDebugString { data, length, .. } => {
                let mut buffer = vec![0u8; length];
                child.read_memory(data, &mut buffer)
                    .expect("failed reading debug string");

                let string = String::from_utf8_lossy(&buffer);
                println!("{}", string);
            }

            Exception { first_chance, code, address } => {
                if !attached {
                    attached = true;
                } else if !first_chance {
                    println!("passing on last chance exception");
                } else {
                    if code == winapi::EXCEPTION_BREAKPOINT {
                        debug_continue = true;
                    }

                    let (symbol, off) = symbols.symbol_from_address(address)
                        .expect("failed to get symbol");

                    let name = symbol.name.to_string_lossy();
                    println!("exception {:x} at {}+{}", code, name, off);

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

            Rip { .. } => println!("rip event"),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
