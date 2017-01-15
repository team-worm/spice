extern crate debug;

extern crate winapi;

use std::{env, fmt};
use std::cell::RefCell;
use std::collections::HashMap;

fn main() {
    let child = debug::Command::new(env::args().nth(1).unwrap())
        .env_clear()
        .debug()
        .expect("failed to launch process");
    let symbol_name = env::args().nth(2).unwrap();

    let options = debug::SymbolHandler::get_options();
    debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);

    let mut threads = HashMap::new();
    let symbols = debug::SymbolHandler::initialize(&child)
        .expect("failed to initialize symbol handler");
    let symbols = RefCell::new(symbols);

    let mut done = false;
    while !done {
        let event = debug::Event::wait_event()
            .expect("failed to get debug event");

        use debug::EventInfo::*;
        match event.info {
            // FIXME: currently this ignores cp.hProcess and thus only supports a single child
            CreateProcess { ref file, main_thread, base, .. } => {
                threads.insert(event.thread_id, main_thread);

                let symbol;
                let module;
                let symbol_type;
                {
                    let mut symbols = symbols.borrow_mut();

                    symbols.load_module(file.as_ref().unwrap(), base)
                        .expect("failed to load module");

                    symbol = symbols.symbol_from_name(&symbol_name).unwrap();
                    module = symbols.module_from_address(symbol.address).unwrap();
                    symbol_type = symbols.type_from_index(module, symbol.type_index).unwrap();
                }

                println!("{}: {}", symbol_name, Type(symbol_type, &symbols, module));
            }
            ExitProcess { .. } => { done = true; }

            CreateThread { thread, .. } => { threads.insert(event.thread_id, thread); }
            ExitThread { .. } => { threads.remove(&event.thread_id); }

            LoadDll { ref file, base } => {
                let mut symbols = symbols.borrow_mut();
                symbols.load_module(file.as_ref().unwrap(), base)
                    .expect("failed to load module");
            }
            UnloadDll { base } => {
                let mut symbols = symbols.borrow_mut();
                let _ = symbols.unload_module(base);
            }

            _ => (),
        }

        event.continue_event(false)
            .expect("failed to continue thread");
    }
}

struct Type<'a>(debug::Type, &'a RefCell<debug::SymbolHandler>, usize);

impl<'a> fmt::Display for Type<'a> {
    fn fmt(&self, fmt: &mut fmt::Formatter) -> Result<(), fmt::Error> {
        let Type(ref symbol_type, symbols, module) = *self;

        use debug::Type::*;
        match symbol_type {
            &Base { base, size } => {
                use debug::Primitive::*;
                match base {
                    Void => write!(fmt, "()"),
                    Bool => write!(fmt, "bool"),
                    Int { signed } => {
                        let prefix = if signed { "i" } else { "u" };
                        write!(fmt, "{}{}", prefix, 8 * size)
                    }
                    Float => write!(fmt, "f{}", 8 * size),
                }
            }

            &Pointer { type_index } => {
                let target;
                {
                    let mut symbols = symbols.borrow_mut();
                    target = symbols.type_from_index(module, type_index)
                        .map_err(|_| fmt::Error)?;
                }

                write!(fmt, "*{}", Type(target, symbols, module))
            }

            &Array { type_index, count } => {
                let element;
                {
                    let mut symbols = symbols.borrow_mut();
                    element = symbols.type_from_index(module, type_index)
                        .map_err(|_| fmt::Error)?;
                }

                write!(fmt, "[{}; {}]", Type(element, symbols, module), count)
            }

            &Function { type_index, ref args } => {
                write!(fmt, "fn (")?;

                for (i, &arg) in args.iter().enumerate() {
                    let arg_type;
                    {
                        let mut symbols = symbols.borrow_mut();
                        arg_type = symbols.type_from_index(module, arg)
                            .map_err(|_| fmt::Error)?;
                    }

                    let prefix = if i == 0 { "" } else { ", " };
                    write!(fmt, "{}{}", prefix, Type(arg_type, symbols, module))?;
                }

                let ret;
                {
                    let mut symbols = symbols.borrow_mut();
                    ret = symbols.type_from_index(module, type_index)
                        .map_err(|_| fmt::Error)?;
                }

                write!(fmt, ") -> {}", Type(ret, symbols, module))?;

                Ok(())
            }

            &Struct { ref name, .. } => {
                write!(fmt, "{}", name.to_string_lossy())
            }
        }
    }
}
