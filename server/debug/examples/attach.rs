extern crate debug;

extern crate winapi;
extern crate advapi32;
extern crate kernel32;

use std::env;
use std::collections::HashMap;

fn main() {
    let pid = env::args().nth(1).unwrap().parse::<u32>().unwrap();
    let child = debug::Child::attach(pid)
        .expect("failed to attach");

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let symbols = debug::SymbolHandler::initialize(&child)
        .expect("failed to initialize symbol handler");

    let mut done = false;
    while !done {
        let event = debug::Event::wait_event()
            .expect("failed to get debug event");

        let debug_continue = false;

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

            _ => (),
        }

        event.continue_event(debug_continue)
            .expect("failed to continue thread");
    }
}
