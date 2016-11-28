use std::{io, mem};

use winapi;
use kernel32;

/// An event received from a child process
pub struct DebugEvent {
    pub process_id: u32,
    pub thread_id: u32,
    pub info: DebugEventInfo,
}

impl !Send for DebugEvent {}

// TODO: replace raw win32 structs with idiomatic types
pub enum DebugEventInfo {
    CreateProcess(winapi::CREATE_PROCESS_DEBUG_INFO),
    ExitProcess(winapi::EXIT_PROCESS_DEBUG_INFO),
    CreateThread(winapi::CREATE_THREAD_DEBUG_INFO),
    ExitThread(winapi::EXIT_THREAD_DEBUG_INFO),
    LoadDll(winapi::LOAD_DLL_DEBUG_INFO),
    UnloadDll(winapi::UNLOAD_DLL_DEBUG_INFO),
    OutputDebugString(winapi::OUTPUT_DEBUG_STRING_INFO),
    Exception(winapi::EXCEPTION_DEBUG_INFO),
    Rip(winapi::RIP_INFO),
}

impl DebugEvent {
    /// Retrieve the next `DebugEvent` from any child process attached to the curent thread
    pub fn wait_event() -> io::Result<DebugEvent> {
        unsafe {
            let mut event = mem::uninitialized();
            if kernel32::WaitForDebugEvent(&mut event, winapi::INFINITE) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            let process_id = event.dwProcessId;
            let thread_id = event.dwThreadId;

            use self::DebugEventInfo::*;
            let info = match event.dwDebugEventCode {
                winapi::CREATE_PROCESS_DEBUG_EVENT => CreateProcess(*event.CreateProcessInfo()),
                winapi::EXIT_PROCESS_DEBUG_EVENT => ExitProcess(*event.ExitProcess()),
                winapi::CREATE_THREAD_DEBUG_EVENT => CreateThread(*event.CreateThread()),
                winapi::EXIT_THREAD_DEBUG_EVENT => ExitThread(*event.ExitThread()),
                winapi::LOAD_DLL_DEBUG_EVENT => LoadDll(*event.LoadDll()),
                winapi::UNLOAD_DLL_DEBUG_EVENT => UnloadDll(*event.UnloadDll()),
                winapi::OUTPUT_DEBUG_STRING_EVENT => OutputDebugString(*event.DebugString()),
                winapi::EXCEPTION_DEBUG_EVENT => Exception(*event.Exception()),
                winapi::RIP_EVENT => Rip(*event.RipInfo()),

                _ => unreachable!()
            };

            Ok(DebugEvent { process_id, thread_id, info })
        }
    }

    /// Continue the child process that generated this event
    ///
    /// For `DebugEventInfo::Exception` events, `handled` signifies whether the debugger handled
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
        let DebugEvent { ref process_id, ref thread_id, .. } = *self;

        unsafe {
            if kernel32::ContinueDebugEvent(*process_id, *thread_id, status) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }
        }

        Ok(())
    }
}

impl Drop for DebugEvent {
    fn drop(&mut self) {
        let _ = self.continue_status(winapi::DBG_EXCEPTION_NOT_HANDLED as winapi::DWORD);
    }
}
