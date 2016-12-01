use std::{io, env, iter, mem, ptr};
use std::ffi::{OsString, OsStr};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{RawHandle, AsRawHandle, IntoRawHandle};
use std::collections::HashMap;

use winapi;
use kernel32;

/// A running or exited debugee process, created via a `Command`
pub struct Child(winapi::HANDLE);

impl Child {
    /// Read `buffer.len()` bytes from a process's address space at `address`
    pub fn read_memory(&self, address: usize, buffer: &mut [u8]) -> io::Result<usize> {
        unsafe {
            let mut read = 0;
            if kernel32::ReadProcessMemory(
                self.0, address as winapi::LPCVOID,
                buffer.as_mut_ptr() as winapi::LPVOID, buffer.len() as winapi::SIZE_T,
                &mut read
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(read as usize)
        }
    }

    /// Write `buffer.len()` bytes into a process's address space at `address`
    pub fn write_memory(&mut self, address: usize, buffer: &[u8]) -> io::Result<usize> {
        unsafe {
            let mut written = 0;
            if kernel32::WriteProcessMemory(
                self.0, address as winapi::LPVOID,
                buffer.as_ptr() as winapi::LPCVOID, buffer.len() as winapi::SIZE_T,
                &mut written
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(written as usize)
        }
    }

    pub fn set_breakpoint(&mut self, address: usize) -> io::Result<Breakpoint> {
        let mut saved = [0u8; 1];
        self.read_memory(address, &mut saved)?;
        self.write_memory(address, &[0xCCu8])?;
        Ok(Breakpoint { address, saved })
    }

    pub fn remove_breakpoint(&mut self, breakpoint: Breakpoint) -> io::Result<()> {
        self.write_memory(breakpoint.address, &breakpoint.saved)?;
        Ok(())
    }
}

impl AsRawHandle for Child {
    fn as_raw_handle(&self) -> RawHandle { self.0 }
}

impl IntoRawHandle for Child {
    fn into_raw_handle(self) -> RawHandle { self.0 }
}

/// An enabled breakpoint in a child process
pub struct Breakpoint {
    address: usize,
    saved: [u8; 1],
}

/// The state of a suspended thread
pub struct Context(winapi::CONTEXT);

impl Context {
    pub fn set_instruction_pointer(&mut self, address: usize) {
        self.0.Rip = address as winapi::DWORD64;
    }

    pub fn set_singlestep(&mut self, singlestep: bool) {
        if singlestep {
            self.0.EFlags |= 0x100;
        } else {
            self.0.EFlags &= !0x100;
        }
    }

    pub fn into_raw(self) -> winapi::CONTEXT { self.0 }
}

/// Read a suspended thread's CPU state
pub fn get_thread_context(thread: winapi::HANDLE, flags: winapi::DWORD) -> io::Result<Context> {
    unsafe {
        let mut context = winapi::CONTEXT {
            ContextFlags: flags,
            ..mem::zeroed()
        };
        if kernel32::GetThreadContext(thread, &mut context) == winapi::FALSE {
            return Err(io::Error::last_os_error());
        }

        Ok(Context(context))
    }
}

/// Write a suspended thread's CPU state
pub fn set_thread_context(thread: winapi::HANDLE, context: &Context) -> io::Result<()> {
    unsafe {
        if kernel32::SetThreadContext(thread, &context.0) == winapi::FALSE {
            return Err(io::Error::last_os_error());
        }

        Ok(())
    }
}

/// Custom implementation of `std::process::Command` to debug child processes.
/// Lacks some features that we don't need:
///
/// * Does not look up `program` in `PATH`
/// * Child does not inherit stdio handles
pub struct Command {
    program: OsString,
    args: Vec<OsString>,
    env: Option<HashMap<OsString, OsString>>,
}

impl Command {
    /// Construct a new `Command` with default configuration:
    ///
    /// * No arguments
    /// * Inherit parent environment
    /// * Inherit parent working directory
    pub fn new<S: AsRef<OsStr>>(program: S) -> Command {
        Command {
            program: program.as_ref().to_os_string(),
            args: vec![],
            env: None,
        }
    }

    /// Add an argument to pass to the program.
    pub fn arg<S: AsRef<OsStr>>(&mut self, arg: S) -> &mut Command {
        self.args.push(arg.as_ref().to_os_string());
        self
    }

    fn init_env_map(&mut self) {
        if self.env.is_none() {
            self.env = Some(env::vars_os().collect());
        }
    }

    /// Add a variable to the child process's environment.
    pub fn env<K, V>(&mut self, key: K, value: V) -> &mut Command
        where K: AsRef<OsStr>, V: AsRef<OsStr>
    {
        self.init_env_map();
        self.env.as_mut().unwrap().insert(
            key.as_ref().to_os_string(), value.as_ref().to_os_string()
        );
        self
    }

    /// Clear the environment of the child process.
    pub fn env_clear(&mut self) -> &mut Command {
        self.env = Some(HashMap::new());
        self
    }

    /// Execute the command as a child process and return a handle to it.
    pub fn debug(&mut self) -> io::Result<Child> {
        let mut si = winapi::STARTUPINFOW {
            cb: mem::size_of::<winapi::STARTUPINFOW>() as winapi::DWORD,
            ..unsafe { mem::zeroed() }
        };

        let mut cmd = make_command_line(&self.program, &self.args)?;
        let (env, _env) = make_env(self.env.as_ref())?;

        let mut pi = unsafe { mem::zeroed() };
        unsafe {
            if kernel32::CreateProcessW(
                ptr::null(), cmd.as_mut_ptr(), ptr::null_mut(), ptr::null_mut(), winapi::FALSE,
                winapi::CREATE_NEW_CONSOLE | winapi::DEBUG_ONLY_THIS_PROCESS,
                env as *mut winapi::VOID, ptr::null(), &mut si, &mut pi
            ) != winapi::TRUE {
                return Err(io::Error::last_os_error())
            }

            kernel32::CloseHandle(pi.hThread);
            Ok(Child(pi.hProcess))
        }
    }
}

fn make_command_line(program: &OsStr, args: &[OsString]) -> io::Result<Vec<u16>> {
    let mut cmd = vec![];
    append(&mut cmd, program)?;
    for arg in args {
        cmd.push(' ' as u16);
        append(&mut cmd, arg)?
    }
    cmd.push(0);
    return Ok(cmd);

    fn append(cmd: &mut Vec<u16>, arg: &OsStr) -> io::Result<()> {
        ensure_no_nuls(arg)?;
        if !arg.is_empty() && !arg.encode_wide().any(|c| c == ' ' as u16 || c == '\t' as u16) {
            cmd.extend(arg.encode_wide());
            Ok(())
        } else {
            cmd.push('"' as u16);

            let mut iter = arg.encode_wide();
            loop {
                let backslashes = iter.clone().take_while(|&c| c == '\\' as u16).count();
                for _ in 0..backslashes { iter.next(); }

                match iter.next() {
                    Some(c) => {
                        let bs = if c == '"' as u16 { 2 * backslashes + 1 } else { backslashes };
                        cmd.extend(iter::repeat('\\' as u16).take(bs));
                        cmd.push(c);
                    },
                    None => {
                        cmd.extend(iter::repeat('\\' as u16).take(2 * backslashes));
                        break;
                    },
                }
            }

            cmd.push('"' as u16);
            Ok(())
        }
    }
}

fn make_env(
    env: Option<&HashMap<OsString, OsString>>
) -> io::Result<(*mut winapi::VOID, Vec<u16>)> {
    match env {
        Some(env) => {
            let mut block = vec![];
            for pair in env {
                block.extend(ensure_no_nuls(pair.0)?.encode_wide());
                block.push('=' as u16);
                block.extend(ensure_no_nuls(pair.1)?.encode_wide());
                block.push(0);
            }
            block.push(0);

            Ok((block.as_mut_ptr() as *mut winapi::VOID, block))
        }

        None => Ok((ptr::null_mut(), vec![]))
    }
}

fn ensure_no_nuls<S: AsRef<OsStr>>(s: S) -> io::Result<S> {
    if s.as_ref().encode_wide().any(|b| b == 0) {
        Err(io::Error::new(io::ErrorKind::InvalidInput, "nul byte found in provided data"))
    } else {
        Ok(s)
    }
}
