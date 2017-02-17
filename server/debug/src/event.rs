use std::{io, mem, ptr};
use std::fs::File;
use std::os::windows::io::{RawHandle, FromRawHandle};

use winapi;
use kernel32;

/// An event received from a child process
pub struct Event {
    pub process_id: u32,
    pub thread_id: u32,
    pub info: EventInfo,
}

impl !Send for Event {}

pub enum EventInfo {
    CreateProcess {
        file: Option<File>,
        process: RawHandle,
        main_thread: RawHandle,
        base: usize,
        start_address: usize,
    },
    ExitProcess { exit_code: u32 },

    CreateThread { thread: RawHandle, start_address: usize },
    ExitThread { exit_code: u32 },

    LoadDll { file: Option<File>, base: usize },
    UnloadDll { base: usize },

    OutputDebugString { data: usize, length: usize, unicode: bool },

    Exception {
        first_chance: bool,
        code: u32,
        address: usize,
    },

    Rip { error: u32, error_type: u32 },
}

impl Event {
    /// Retrieve the next `Event` from any child process attached to the curent thread
    pub fn wait_event() -> io::Result<Event> {
        unsafe {
            let mut event = mem::uninitialized();
            if kernel32::WaitForDebugEvent(&mut event, winapi::INFINITE) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            let process_id = event.dwProcessId;
            let thread_id = event.dwThreadId;

            use self::EventInfo::*;
            let info = match event.dwDebugEventCode {
                winapi::CREATE_PROCESS_DEBUG_EVENT => {
                    let cp = event.CreateProcessInfo();

                    let file = if cp.hFile != ptr::null_mut() {
                        Some(File::from_raw_handle(cp.hFile))
                    } else {
                        None
                    };
                    let process = cp.hProcess;
                    let main_thread = cp.hThread;
                    let base = cp.lpBaseOfImage as usize;
                    let start_address = mem::transmute(cp.lpStartAddress);

                    CreateProcess { file, process, main_thread, base, start_address }
                }
                winapi::EXIT_PROCESS_DEBUG_EVENT => {
                    let ep = event.ExitProcess();
                    
                    let exit_code = ep.dwExitCode;
                    ExitProcess { exit_code }
                }

                winapi::CREATE_THREAD_DEBUG_EVENT => {
                    let ct = event.CreateThread();

                    let thread = ct.hThread;
                    let start_address = mem::transmute(ct.lpStartAddress);

                    CreateThread { thread, start_address }
                }
                winapi::EXIT_THREAD_DEBUG_EVENT => {
                    let et = event.ExitThread();
                    
                    let exit_code = et.dwExitCode;
                    ExitThread { exit_code }
                }

                winapi::LOAD_DLL_DEBUG_EVENT => {
                    let ld = event.LoadDll();

                    let file = if ld.hFile != ptr::null_mut() {
                        Some(File::from_raw_handle(ld.hFile))
                    } else {
                        None
                    };

                    let base = ld.lpBaseOfDll as usize;

                    LoadDll { file, base }
                }
                winapi::UNLOAD_DLL_DEBUG_EVENT => {
                    let ud = event.UnloadDll();

                    let base = ud.lpBaseOfDll as usize;
                    UnloadDll { base }
                }

                winapi::OUTPUT_DEBUG_STRING_EVENT => {
                    let ds = event.DebugString();

                    let data = ds.lpDebugStringData as usize;
                    let length = ds.nDebugStringLength as usize;
                    let unicode = ds.fUnicode != 0;
                    OutputDebugString { data, length, unicode }
                }

                winapi::EXCEPTION_DEBUG_EVENT => {
                    let e = event.Exception();
                    let ref er = e.ExceptionRecord;

                    let first_chance = e.dwFirstChance != 0;
                    let code = er.ExceptionCode;
                    let address = er.ExceptionAddress as usize;
                    Exception { first_chance, code, address }
                },

                winapi::RIP_EVENT => {
                    let rip = event.RipInfo();

                    let error = rip.dwError;
                    let error_type = rip.dwType;
                    Rip { error, error_type }
                }

                _ => unreachable!()
            };

            Ok(Event { process_id, thread_id, info })
        }
    }

    /// Continue the child process that generated this event
    ///
    /// For `EventInfo::Exception` events, `handled` signifies whether the debugger handled
    /// the exception. If `handled == false`, the exception is passed on to the child process.
    pub fn continue_event(mut self, handled: bool) -> io::Result<()> {
        let status = if handled {
            winapi::DBG_CONTINUE
        } else {
            winapi::DBG_EXCEPTION_NOT_HANDLED
        } as winapi::DWORD;

        self.continue_status(status)?;

        mem::forget(self);
        Ok(())
    }

    fn continue_status(&mut self, status: winapi::DWORD) -> io::Result<()> {
        let Event { ref process_id, ref thread_id, .. } = *self;

        unsafe {
            if kernel32::ContinueDebugEvent(*process_id, *thread_id, status) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }
        }

        Ok(())
    }
}

impl Drop for Event {
    fn drop(&mut self) {
        let _ = self.continue_status(winapi::DBG_EXCEPTION_NOT_HANDLED as winapi::DWORD);
    }
}
