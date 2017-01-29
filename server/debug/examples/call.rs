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

    let mut start = None;
    let mut finish = None;

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

                let breakpoint = child.set_breakpoint(start_address)
                    .expect("failed to set breakpoint");
                start = Some((start_address, breakpoint));
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
                    debug_continue = true;
                } else if !first_chance {
                } else if code == winapi::EXCEPTION_BREAKPOINT {
                    let thread = threads[&event.thread_id];
                    let mut context = debug::get_thread_context(thread, winapi::CONTEXT_FULL)
                        .expect("failed to get context");
                    context.set_instruction_pointer(address);

                    if let Some((start, start_breakpoint)) = start.take() {
                        assert_eq!(start, address);
                        child.remove_breakpoint(start_breakpoint)
                            .expect("failed to remove breakpoint");

                        let function = symbols.symbol_from_name(&function_name)
                            .expect("failed to get symbol");
                        let module = symbols.module_from_address(function.address)
                            .expect("failed to get module");

                        let arg_type = debug::Type::Base {
                            base: debug::Primitive::Int { signed: true }, size: 4
                        };
                        let args = vec![
                            debug::Value {
                                data: vec![5, 0, 0, 0], data_type: arg_type.clone(), module: module
                            },
                            debug::Value {
                                data: vec![7, 0, 0, 0], data_type: arg_type.clone(), module: module
                            },
                        ];

                        let call = debug::Call::setup(
                            &mut child, &mut context, &symbols, &function, args 
                        ).expect("failed to set up function call");
                        debug::set_thread_context(thread, &context)
                            .expect("failed to set context");

                        let breakpoint = child.set_breakpoint(address)
                            .expect("failed to create breakpoint");
                        finish = Some((address, breakpoint, call));
                    } else if let Some((finish, finish_breakpoint, call)) = finish.take() {
                        assert_eq!(finish, address);
                        child.remove_breakpoint(finish_breakpoint)
                            .expect("failed to remove breakpoint");

                        let (value, restore) = call.teardown(&child, &context, &symbols)
                            .expect("failed to read return value");
                        debug::set_thread_context(thread, &restore)
                            .expect("failed to set context");

                        println!("returned {}", value.display(&symbols));
                        child.terminate().unwrap();
                        break;
                    } else {
                        panic!("unexpected breakpoint");
                    }

                    debug_continue = true;
                }
            }

            _ => (),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
