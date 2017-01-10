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

    let mut done = false;
    while !done {
        let event = debug::Event::wait_event()
            .expect("failed to get debug event");

        use debug::EventInfo::*;
        match event.info {
            // FIXME: currently this ignores cp.hProcess and thus only supports a single child
            CreateProcess { ref file, main_thread, base, .. } => {
                threads.insert(event.thread_id, main_thread);

                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");

                let mut functions = vec![];
                symbols.enumerate_functions(|function, size| {
                    functions.push((
                        function.name.to_string_lossy().into_owned(), function.address, size
                    ));
                    true
                }).expect("failed to enumerate functions");

                for (name, address, size) in functions {
                    let (function, _) = symbols.symbol_from_address(address).unwrap();

                    let start = match symbols.line_from_address(address) {
                        Ok((line, _)) => line,
                        Err(_) => continue,
                    };
                    let end = match symbols.line_from_address(address + size - 1) {
                        Ok((line, _)) => line,
                        Err(_) => continue,
                    };

                    println!(
                        "{}:{}-{} @ {:x}",
                        start.file.to_string_lossy(), start.line, end.line, address,
                    );

                    let mut parameters = vec![];
                    symbols.enumerate_locals(address, |symbol, _| {
                        if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
                            parameters.push(symbol.name.to_string_lossy().into_owned());
                        }
                        true
                    }).expect("failed to enumerate symbols");

                    let mut locals = HashMap::new();
                    let mut id = 0;
                    for line in symbols.lines_from_symbol(&function).unwrap() {
                        symbols.enumerate_locals(line.address, |symbol, _| {
                            if symbol.flags & winapi::SYMFLAG_PARAMETER == 0 {
                                locals.entry(symbol.name.to_string_lossy().into_owned())
                                    .or_insert_with(|| { id += 1; id });
                            }
                            true
                        }).expect("failed to enumerate symbols");
                    }

                    println!("  {}({}) {{", name, parameters.join(", "));
                    for (local, _) in locals {
                        println!("    {};", local);
                    }
                    println!("  }}");
                }
            }
            ExitProcess { .. } => { done = true; }

            CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
            ExitThread { .. } => { threads.remove(&event.thread_id); }

            LoadDll { ref file, base } => {
                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");
            }
            UnloadDll { base } => { let _ = symbols.unload_module(base); }

            OutputDebugString { data, length, .. } => {
                let mut buffer = vec![0u8; length];
                child.read_memory(data, &mut buffer)
                    .expect("failed reading debug string");

                let string = String::from_utf8_lossy(&buffer);
                println!("{}", string);
            }

            Exception { code, address, .. } => {
                let (symbol, off) = symbols.symbol_from_address(address)
                    .expect("failed to get symbol");

                let name = symbol.name.to_string_lossy();

                let frame = symbols.walk_stack(threads[&event.thread_id])
                    .expect("failed to get thread stack")
                    .nth(0)
                    .expect("failed to get stack frame");

                let address = frame.stack.AddrPC.Offset as usize;
                let file = match symbols.line_from_address(address) {
                    Ok((line, _)) => format!("{}:{}", line.file.to_string_lossy(), line.line),
                    Err(_) => "".to_string(),
                };

                println!("exception {:x} at {}+{} {}", code, name, off, file);
            }

            Rip { .. } => println!("rip event"),
        }

        event.continue_event(false)
            .expect("failed to continue thread");
    }
}
