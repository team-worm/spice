extern crate debug;

extern crate winapi;

use std::env;
use std::collections::HashMap;

fn main() {
    let mut child = debug::Command::new(env::args().nth(1).unwrap())
        .env_clear()
        .debug()
        .expect("failed to launch process");
    let function_name = env::args().nth(2).unwrap();

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let mut symbols = debug::SymbolHandler::initialize(&child)
        .expect("failed to initialize symbol handler");

    let mut attached = false;

    let mut breakpoints = HashMap::new();
    let mut last_breakpoint = None;

    let mut first_line = true;
    let mut last_line = 0;

    let mut done = false;
    while !done {
        let event = debug::Event::wait_event()
            .expect("failed to get debug event");

        let mut debug_continue = false;

        use debug::EventInfo::*;
        match event.info {
            // FIXME: currently this ignores cp.hProcess and thus only supports a single child
            CreateProcess { ref file, main_thread, base, .. } => {
                threads.insert(event.thread_id, main_thread);

                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");
            }
            ExitProcess { .. } => { done = true; }

            CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
            ExitThread { .. } => { threads.remove(&event.thread_id); }

            LoadDll { ref file, base } => {
                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");
            }
            UnloadDll { base } => { let _ = symbols.unload_module(base); }

            Exception { first_chance, code, address } => {
                if !attached {
                    attached = true;

                    let function = symbols.symbol_from_name(&function_name)
                        .expect("failed to get symbol");
                    let mut parameters = vec![];
                    symbols.enumerate_locals(function.address, |symbol, _| {
                        if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
                            parameters.push(symbol.name.to_string_lossy().into_owned());
                        }
                        true
                    }).expect("failed to enumerate symbols");

                    println!("{}({});", function_name, parameters.join(", "));

                    let lines = symbols.lines_from_symbol(&function)
                        .expect("failed to get lines");
                    for line in lines {
                        let breakpoint = child.set_breakpoint(line.address)
                            .expect("failed to set breakpoint");

                        breakpoints.insert(line.address, Some(breakpoint));
                    }

                    debug_continue = true;
                } else if !first_chance {
                    println!("passing on last chance exception");
                } else if code == winapi::EXCEPTION_BREAKPOINT {
                    let breakpoint = breakpoints.get_mut(&address)
                        .expect("hit untracked breakpoint")
                        .take();
                    child.remove_breakpoint(breakpoint.unwrap())
                        .expect("failed to remove breakpoint");
                    last_breakpoint = Some(address);

                    let mut context = debug::get_thread_context(
                        threads[&event.thread_id], winapi::CONTEXT_FULL
                    ).expect("failed to get thread context");
                    context.set_instruction_pointer(address);
                    context.set_singlestep(true);
                    debug::set_thread_context(threads[&event.thread_id], &context)
                        .expect("failed to set thread context");

                    let frame = symbols.walk_stack(threads[&event.thread_id])
                        .expect("failed to get thread stack")
                        .nth(0)
                        .expect("failed to get stack frame");
                    let ref context = frame.context;
                    let ref stack = frame.stack;

                    let (line, _off) = symbols.line_from_address(address)
                        .expect("failed to get line");

                    let instruction = stack.AddrPC.Offset as usize;
                    let mut locals = vec![];
                    symbols.enumerate_locals(instruction, |symbol, size| {
                        if size == 0 { return true; }

                        let name = symbol.name.to_string_lossy();

                        let value = match debug::Value::read(&child, &symbols, &context, &symbol) {
                            Ok(value) => value,
                            Err(_) => return true,
                        };

                        // heuristic for windows' uninitialized value pattern
                        if value.data[0] == 0xcc {
                            return true;
                        }

                        locals.push(format!("{} = {}", name, value.display(&symbols)));
                        true
                    }).expect("failed to enumerate symbols");

                    if first_line {
                        first_line = false;
                    } else {
                        println!("{}: {}", last_line, locals.join("; "));
                    }

                    last_line = line.line;

                    debug_continue = true;
                } else if code == winapi::EXCEPTION_SINGLE_STEP {
                    let address = last_breakpoint.take().unwrap();
                    let breakpoint = child.set_breakpoint(address)
                        .expect("failed to restore breakpoint");
                    breakpoints.insert(address, Some(breakpoint));

                    let mut context = debug::get_thread_context(
                        threads[&event.thread_id], winapi::CONTEXT_FULL
                    ).expect("failed to get thread context");
                    context.set_singlestep(false);
                    debug::set_thread_context(threads[&event.thread_id], &context)
                        .expect("failed to set thread context");

                    debug_continue = true;
                }
            }

            _ => (),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
