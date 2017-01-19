extern crate debug;

extern crate winapi;
extern crate advapi32;
extern crate kernel32;


use std::{env, ptr, mem, fs, ffi, path, str};
use std::collections::HashMap;


//TODO:  Create a c file that runs forever so we can break into it via pid for testing

// argument to pass should be pid of running process
fn main() {
    let pid = env::args().nth(1).unwrap().parse::<u32>().unwrap();

    unsafe {
        let h_process = kernel32::OpenProcess(
            winapi::winnt::PROCESS_VM_READ | winapi::winnt::PROCESS_QUERY_INFORMATION,
            winapi::minwindef::TRUE, pid);


        // set debug privileges

        let mut token_handle: std::os::windows::io::RawHandle = mem::zeroed();

        advapi32::OpenProcessToken(h_process, winapi::winnt::TOKEN_ALL_ACCESS, &mut token_handle);
        
        let mut tp = (winapi::winnt::TOKEN_PRIVILEGES{
            PrivilegeCount: 0, ..mem::zeroed()
        }, [winapi::winnt::LUID_AND_ATTRIBUTES{
            Luid: winapi::winnt::LUID{LowPart: 0, HighPart:0}, Attributes: 0}; 1]);

        let mut luid = winapi::winnt::LUID{LowPart: 0, HighPart: 0};
        
        let debug_privilege = ffi::CString::new("SeDebugPrivilege").unwrap();
        if advapi32::LookupPrivilegeValueA(ptr::null(),
                                           debug_privilege.as_ptr(), &mut luid) == winapi::minwindef::FALSE {
            println!("Error in LookupPrivilegeValue");
            // return an error
        }

        tp.0.PrivilegeCount = 1;
        tp.1[0].Luid = luid;
        tp.1[0].Attributes = winapi::winnt::SE_PRIVILEGE_ENABLED;

        if advapi32::AdjustTokenPrivileges(
            token_handle, winapi::minwindef::FALSE, &mut tp.0,
            mem::size_of::<winapi::winnt::TOKEN_PRIVILEGES>() as u32,
            ptr::null_mut(), ptr::null_mut()) == winapi::minwindef::FALSE {

            println!("Error in AdjustTokenPrivileges");
            //throw some error
        }

        // at this point we should have a h_process to a process with the approrpiate privileges
        // create a child object with the process h_process

        let child = debug::Child::new(h_process).unwrap();

        let options = debug::SymbolHandler::get_options();
        debug::SymbolHandler::set_options(winapi::SYMOPT_DEBUG | winapi::SYMOPT_LOAD_LINES | options);
        
        let mut symbols = debug::SymbolHandler::initialize(&child)
            .expect("failed to initialize symbol handler");


        //        let mut threads = get_threads_for_pid(pid).unwrap();
        let mut threads = HashMap::new();

        //load_mod_symbols_for_pid(pid, &mut symbols);

        if kernel32::DebugActiveProcess(pid) == winapi::minwindef::FALSE {
            println!("Error trying to debug active process");
            //throw some error
        }

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

                    // since the process is already running the start address is zero
                    if start_address != 0 {
                        symbols.symbol_from_address(start_address)
                            .expect("failed to get symbol");
                    } 
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
                            let _ = symbols.enumerate_locals(instruction, |symbol, size| {
                                if size == 0 { return true; }

                                let name = symbol.name.to_string_lossy();

                                let mut buffer = vec![0u8; size];
                                match child.read_memory(
                                    context.Rbp as usize + symbol.address, &mut buffer
                                ) {
                                    Ok(_) => {
                                        let value = match size {
                                            4 => *(buffer.as_ptr() as *const u32) as u64 ,
                                            8 => *(buffer.as_ptr() as *const u64) as u64 ,
                                            _ => *(buffer.as_ptr() as *const u32) as u64 ,
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

        kernel32::CloseHandle(h_process);
    }
}
