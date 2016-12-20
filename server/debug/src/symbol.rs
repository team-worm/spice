use std::{io, mem, ptr};
use std::fs::File;
use std::sync::Mutex;
use std::ffi::{OsString, OsStr};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{RawHandle, AsRawHandle};

use winapi;
use kernel32;
use dbghelp;

use {Child, FromWide};

lazy_static! {
    static ref HANDLE: Mutex<Handle> = Mutex::new(Handle(None));
}

struct Handle(Option<RawHandle>);
unsafe impl Send for Handle {}
unsafe impl Sync for Handle {}

pub struct SymbolHandler(RawHandle);

impl SymbolHandler {
    pub fn get_options() -> winapi::DWORD {
        unsafe { dbghelp::SymGetOptions() }
    }

    pub fn set_options(options: winapi::DWORD) {
        unsafe { dbghelp::SymSetOptions(options) };
    }

    /// Initialize the process's symbol handler
    ///
    /// A process can only contain a single symbol handler. This function will fail if one already
    /// exists.
    pub fn initialize(process: &Child) -> io::Result<SymbolHandler> {
        let process = process.as_raw_handle();

        let Handle(ref mut handle) = *HANDLE.lock().unwrap();
        if handle.is_some() {
            return Err(io::Error::new(io::ErrorKind::AlreadyExists, "symbol handler"));
        }

        unsafe {
            if dbghelp::SymInitializeW(process, ptr::null(), winapi::FALSE) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }
        }

        *handle = Some(process);
        Ok(SymbolHandler(process))
    }

    /// Load the symbols for a module
    pub fn load_module(&mut self, file: &File, base: usize) -> io::Result<()> {
        unsafe {
            // TODO: if we want to enable deferred symbol loading, we need to pass module size too
            if dbghelp::SymLoadModuleExW(
                self.0, file.as_raw_handle(), ptr::null(), ptr::null(),
                base as winapi::DWORD64, 0, ptr::null_mut(), 0
            ) == 0 {
                return Err(io::Error::last_os_error());
            }

            Ok(())
        }
    }

    /// Unload the symbols for a module
    pub fn unload_module(&mut self, base: usize) -> io::Result<()> {
        unsafe {
            if dbghelp::SymUnloadModule64(self.0, base as winapi::DWORD64) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(())
        }
    }

    /// Retrieve the symbol and byte offset of an address
    pub fn symbol_from_address(&mut self, address: usize) -> io::Result<(Symbol, usize)> {
        unsafe {
            let mut displacement = 0;
            let mut symbol = (winapi::SYMBOL_INFOW {
                SizeOfStruct: mem::size_of::<winapi::SYMBOL_INFOW>() as winapi::ULONG,
                MaxNameLen: winapi::MAX_SYM_NAME as winapi::ULONG,
                ..mem::zeroed()
            }, [0 as winapi::WCHAR; (winapi::MAX_SYM_NAME - 1) as usize]);

            if dbghelp::SymFromAddrW(
                self.0, address as winapi::DWORD64, &mut displacement, &mut symbol.0
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            let name = OsString::from_wide_raw_len(
                symbol.0.Name.as_ptr(), symbol.0.NameLen as usize
            );

            Ok((Symbol {
                name,
                address: symbol.0.Address as usize,
                size: symbol.0.Size as usize,
                flags: symbol.0.Flags
            }, displacement as usize))
        }
    }

    pub fn symbol_from_name<S: AsRef<OsStr>>(&mut self, name: S) -> io::Result<Symbol> {
        let name_wide: Vec<u16> = name.as_ref().encode_wide().chain(Some(0)).collect();

        unsafe {
            let mut symbol = winapi::SYMBOL_INFOW {
                SizeOfStruct: mem::size_of::<winapi::SYMBOL_INFOW>() as winapi::ULONG,
                ..mem::zeroed()
            };
            if dbghelp::SymFromNameW(self.0, name_wide.as_ptr(), &mut symbol) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(Symbol {
                name: name.as_ref().to_owned(),
                address: symbol.Address as usize,
                size: symbol.Size as usize,
                flags: symbol.Flags,
            })
        }
    }

    pub fn enumerate_functions<F>(&mut self, f: F) -> io::Result<()>
        where F: FnMut(&Symbol, usize) -> bool
    {
        struct Context<'a, F> { symbols: &'a mut SymbolHandler, f: F }
        let mut context = Context { symbols: self, f };

        let mask: Vec<u16> = OsStr::new("*!*").encode_wide().chain(Some(0)).collect();
        unsafe {
            if dbghelp::SymEnumSymbolsW(
                context.symbols.0, 0, mask.as_ptr(),
                Some(enum_functions::<F>), &mut context as *mut _ as *mut _
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            return Ok(());
        }

        #[allow(non_snake_case)]
        unsafe extern "system" fn enum_functions<F>(
            pSymInfo: winapi::PSYMBOL_INFOW, SymbolSize: winapi::ULONG, UserContext: winapi::PVOID
        ) -> winapi::BOOL
            where F: FnMut(&Symbol, usize) -> bool
        {
            let symbol = &*pSymInfo;
            let Context {
                ref symbols,
                ref mut f,
            } = *(UserContext as *mut Context<F>);

            let mut module = winapi::IMAGEHLP_MODULEW64 {
                SizeOfStruct: mem::size_of::<winapi::IMAGEHLP_MODULEW64>() as winapi::DWORD,
                .. mem::zeroed()
            };
            if dbghelp::SymGetModuleInfoW64(
                symbols.0, symbol.Address, &mut module
            ) == winapi::FALSE {
                return winapi::TRUE;
            }

            let mut tag: winapi::DWORD = 0;
            if dbghelp::SymGetTypeInfo(
                symbols.0, module.BaseOfImage, symbol.Index,
                winapi::TI_GET_SYMTAG, &mut tag as *mut _ as *mut _
            ) == winapi::FALSE {
                return winapi::TRUE;
            }

            if tag != 5 {
                return winapi::TRUE;
            }

            let symbol = Symbol {
                // for some reason, pSymInfo.NameLen includes the null terminator here
                name: OsString::from_wide_raw(symbol.Name.as_ptr()),
                address: symbol.Address as usize,
                size: SymbolSize as usize,
                flags: symbol.Flags,
            };
            if f(&symbol, SymbolSize as usize) { winapi::TRUE } else { winapi::FALSE }
        }
    }

    /// Retrieve the source line and byte offset of an instruction address
    pub fn line_from_address(&mut self, address: usize) -> io::Result<(Line, usize)> {
        unsafe {
            let mut displacement = 0;
            let mut line = winapi::IMAGEHLP_LINEW64 {
                SizeOfStruct: mem::size_of::<winapi::IMAGEHLP_LINEW64>() as winapi::DWORD,
                ..mem::zeroed()
            };

            if dbghelp::SymGetLineFromAddrW64(
                self.0, address as winapi::DWORD64, &mut displacement, &mut line
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok((Line {
                file: OsString::from_wide_raw(line.FileName),
                line: line.LineNumber,
                address: line.Address as usize
            }, displacement as usize))
        }
    }

    /// Iterate through the source lines of a function
    pub fn lines_from_symbol(&mut self, symbol: &Symbol) -> io::Result<Lines> {
        unsafe {
            let mut displacement = 0;
            let mut line = winapi::IMAGEHLP_LINEW64 {
                SizeOfStruct: mem::size_of::<winapi::IMAGEHLP_LINEW64>() as winapi::DWORD,
                ..mem::zeroed()
            };

            if dbghelp::SymGetLineFromAddrW64(
                self.0, symbol.address as winapi::DWORD64, &mut displacement, &mut line
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(Lines { process: self.0, line, end: symbol.address + symbol.size })
        }
    }

    /// Iterate through the frames of a thread's stack
    ///
    /// The thread should be part of an attached child process which is currently paused to handle
    /// a debug event.
    pub fn walk_stack(&mut self, thread: RawHandle) -> io::Result<StackFrames> {
        unsafe {
            let context = ::get_thread_context(thread, winapi::CONTEXT_FULL)?.into_raw();

            fn flat(address: winapi::DWORD64) -> winapi::ADDRESS64 {
                winapi::ADDRESS64 { Offset: address, Mode: winapi::AddrModeFlat, Segment: 0 }
            }
            let stack = winapi::STACKFRAME64 {
                AddrPC: flat(context.Rip),
                AddrFrame: flat(context.Rbp),
                AddrStack: flat(context.Rsp),
                ..mem::zeroed()
            };

            Ok(StackFrames { process: self.0, thread, context, stack })
        }
    }

    /// Enumerate the local symbols of a stack frame
    ///
    /// Addresses are base-pointer-relative.
    pub fn enumerate_locals<F>(&self, address: usize, mut f: F) -> io::Result<()>
        where F: FnMut(&Symbol, usize) -> bool
    {
        unsafe {
            let mut stack_frame = winapi::IMAGEHLP_STACK_FRAME {
                InstructionOffset: address as winapi::DWORD64,
                ..mem::zeroed()
            };
            if
                dbghelp::SymSetContext(self.0, &mut stack_frame, ptr::null_mut()) == winapi::FALSE
                && kernel32::GetLastError() != winapi::ERROR_SUCCESS
            {
                return Err(io::Error::last_os_error());
            }

            if dbghelp::SymEnumSymbolsW(
                self.0, 0, ptr::null(), Some(enum_locals::<F>), &mut f as *mut _ as *mut _
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            return Ok(());
        }

        #[allow(non_snake_case)]
        unsafe extern "system" fn enum_locals<F>(
            pSymInfo: winapi::PSYMBOL_INFOW, SymbolSize: winapi::ULONG, UserContext: winapi::PVOID
        ) -> winapi::BOOL
            where F: FnMut(&Symbol, usize) -> bool
        {
            let symbol = &*pSymInfo;
            let mut f = &mut *(UserContext as *mut F);

            let symbol = Symbol {
                // for some reason, pSymInfo.NameLen includes the null terminator here
                name: OsString::from_wide_raw(symbol.Name.as_ptr()),
                address: symbol.Address as usize,
                size: SymbolSize as usize,
                flags: symbol.Flags,
            };
            if f(&symbol, SymbolSize as usize) { winapi::TRUE } else { winapi::FALSE }
        }
    }
}

impl Drop for SymbolHandler {
    fn drop(&mut self) {
        let Handle(ref mut handle) = *HANDLE.lock().unwrap();

        unsafe {
            dbghelp::SymCleanup(self.0);
        }

        *handle = None;
    }
}

/// The name and address of a debugging symbol
///
/// Will be expanded on to include type information, etc.
pub struct Symbol {
    pub name: OsString,
    pub address: usize,
    pub size: usize,
    pub flags: winapi::ULONG,
}

/// The file, line number, and first instruction address of a source line
pub struct Line {
    pub file: OsString,
    pub line: u32,
    pub address: usize,
}

/// Iterator of source lines
pub struct Lines {
    process: RawHandle,
    line: winapi::IMAGEHLP_LINEW64,
    end: usize,
}

impl Iterator for Lines {
    type Item = Line;

    fn next(&mut self) -> Option<Self::Item> {
        if self.line.Address as usize >= self.end {
            return None;
        }

        let result = Line {
            file: unsafe { OsString::from_wide_raw(self.line.FileName) },
            line: self.line.LineNumber,
            address: self.line.Address as usize
        };

        unsafe {
            if dbghelp::SymGetLineNextW64(self.process, &mut self.line) == winapi::FALSE {
                return None;
            }
        }

        Some(result)
    }
}

/// An iterator of the frames in a thread's stack
pub struct StackFrames {
    process: RawHandle,
    thread: RawHandle,
    context: winapi::CONTEXT,
    stack: winapi::STACKFRAME64,
}

/// A single stack frame and the context needed to read it
pub struct StackFrame {
    pub context: winapi::CONTEXT,
    pub stack: winapi::STACKFRAME64,
}

impl Iterator for StackFrames {
    type Item = StackFrame;

    fn next(&mut self) -> Option<Self::Item> {
        #[cfg(target_arch = "x86_64")]
        const MACHINE_TYPE: winapi::DWORD = winapi::IMAGE_FILE_MACHINE_AMD64 as winapi::DWORD;

        unsafe {
            if dbghelp::StackWalk64(
                MACHINE_TYPE, self.process, self.thread,
                &mut self.stack, &mut self.context as *mut _ as *mut _,
                None, Some(dbghelp::SymFunctionTableAccess64), Some(dbghelp::SymGetModuleBase64),
                None
            ) == winapi::FALSE {
                return None;
            }

            if self.stack.AddrPC.Offset == 0 {
                return None;
            }

            Some(StackFrame { context: self.context, stack: self.stack })
        }
    }
}
