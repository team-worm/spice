use std::{mem, ptr, iter, io, env};
use std::ffi::{OsString, OsStr};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{RawHandle, AsRawHandle, IntoRawHandle};
use std::collections::HashMap;

use winapi;
use kernel32;
use advapi32;

use {FromWide, AsBytes};

/// A running or exited debugee process, created via a `Command`
pub struct Child(RawHandle);

/// A handle to a process that can inject breakpoints
pub struct Cancel(RawHandle);
unsafe impl Send for Cancel {}

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
    pub fn write_memory(&self, address: usize, buffer: &[u8]) -> io::Result<usize> {
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

    /// Save the first byte of an instruction and replace it with `int3`
    pub fn set_breakpoint(&self, address: usize) -> io::Result<Breakpoint> {
        let mut saved = [0u8; 1];
        self.read_memory(address, &mut saved)?;
        self.write_memory(address, &[0xCCu8])?;
        Ok(Breakpoint { address, saved })
    }

    /// Restore an instruction that has been replaced with `int3`
    pub fn remove_breakpoint(&self, breakpoint: Breakpoint) -> io::Result<()> {
        self.write_memory(breakpoint.address, &breakpoint.saved)?;
        Ok(())
    }

    pub fn stack_push<B: AsBytes>(&self, context: &mut Context, value: B) -> io::Result<()> {
        let bytes = value.as_bytes();
        let address = context.stack_pointer() - bytes.len();

        context.set_stack_pointer(address);
        self.write_memory(address, &bytes)?;

        Ok(())
    }

    pub fn get_cancel(&self) -> Cancel {
        Cancel(self.0)
    }

    /// Attach to a running process with the permissions required for debugging.
    pub fn attach(pid: u32) -> io::Result<Child> {
        unsafe {
            let access =
                winapi::PROCESS_VM_OPERATION |
                winapi::PROCESS_VM_READ |
                winapi::PROCESS_VM_WRITE |
                winapi::PROCESS_QUERY_INFORMATION;
            let process = kernel32::OpenProcess(access, winapi::TRUE, pid);
            if process == ptr::null_mut() {
                return Err(io::Error::last_os_error());
            }

            let mut token = mem::zeroed();
            advapi32::OpenProcessToken(process, winapi::TOKEN_ALL_ACCESS, &mut token);
            if token == ptr::null_mut() {
                return Err(io::Error::last_os_error());
            }

            let name: Vec<_> = OsStr::new("SeDebugPrivilege")
                .encode_wide().chain(iter::once(0)).collect();
            let mut luid: winapi::LUID = mem::zeroed();
            if advapi32::LookupPrivilegeValueW(
                ptr::null(), name.as_ptr(), &mut luid
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            let mut tp = (winapi::TOKEN_PRIVILEGES {
                PrivilegeCount: 1, ..mem::zeroed()
            }, [winapi::LUID_AND_ATTRIBUTES {
                Luid: luid, Attributes: winapi::SE_PRIVILEGE_ENABLED
            }]);
            if advapi32::AdjustTokenPrivileges(
                token, winapi::FALSE, &mut tp.0, 0, ptr::null_mut(), ptr::null_mut()
            ) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            if kernel32::DebugActiveProcess(pid) == winapi::FALSE {
                panic!("Error in AdjustTokenPrivileges");
            }

            Ok(Child(process))
        }
    }

    pub fn terminate(self) -> io::Result<()> {
        unsafe {
            if kernel32::TerminateProcess(self.0, 0) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(())
        }
    }
}

impl AsRawHandle for Child {
    fn as_raw_handle(&self) -> RawHandle { self.0 }
}

impl IntoRawHandle for Child {
    fn into_raw_handle(self) -> RawHandle { self.0 }
}

impl Cancel {
    /// Inject a breakpoint into the target process.
    /// The debugger can distinguish this from another breakpoint because it's on another thread.
    pub fn trigger_breakpoint(&self) -> io::Result<()> {
        unsafe {
            if kernel32::DebugBreakProcess(self.0) == winapi::FALSE {
                return Err(io::Error::last_os_error());
            }

            Ok(())
        }
    }
}

/// An enabled breakpoint in a child process
pub struct Breakpoint {
    address: usize,
    saved: [u8; 1],
}

/// The state of a suspended thread
#[derive(Clone)]
pub struct Context(winapi::CONTEXT);

impl Context {
    pub fn stack_pointer(&self) -> usize {
        self.0.Rsp as usize
    }

    pub fn set_stack_pointer(&mut self, address: usize) {
        self.0.Rsp = address as winapi::DWORD64;
    }

    pub fn instruction_pointer(&self) -> usize {
        self.0.Rip as usize
    }

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
    pub fn as_raw(&self) -> &winapi::CONTEXT { &self.0 }
    pub fn as_raw_mut(&mut self) -> &mut winapi::CONTEXT { &mut self.0 }
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

/// A running process
pub struct Process {
    pub id: u32,
    pub name: OsString,
}

#[cfg(windows)]
impl Process {
    /// Iterate over currently-running processes
    pub fn running() -> io::Result<Processes> {
        unsafe {
            let snap = kernel32::CreateToolhelp32Snapshot(winapi::TH32CS_SNAPPROCESS, 0);
            if snap == winapi::INVALID_HANDLE_VALUE {
                kernel32::CloseHandle(snap);
                return Err(io::Error::last_os_error());
            }

            let mut pe32 = winapi::PROCESSENTRY32W {
                dwSize: mem::size_of::<winapi::PROCESSENTRY32W>() as u32,
                ..mem::zeroed()
            };
            if kernel32::Process32FirstW(snap, &mut pe32) == winapi::FALSE {
                kernel32::CloseHandle(snap);
                return Err(io::Error::last_os_error());
            }

            Ok(Processes { snap: snap, pe32: pe32 })
        }
    }
}

#[cfg(windows)]
pub struct Processes {
    snap: winapi::HANDLE,
    pe32: winapi::PROCESSENTRY32W,
}

#[cfg(windows)]
impl Iterator for Processes {
    type Item = Process;

    fn next(&mut self) -> Option<Self::Item> {
        if self.snap == ptr::null_mut() {
            return None;
        }

        let result = Process {
            id: self.pe32.th32ProcessID,
            name: OsString::from_wide_null(&self.pe32.szExeFile),
        };

        unsafe {
            if kernel32::Process32NextW(self.snap, &mut self.pe32) == winapi::FALSE {
                kernel32::CloseHandle(self.snap);
                self.snap = ptr::null_mut();
            }
        }

        Some(result)
    }
}

#[cfg(unix)]
impl Process {
    /// Iterate over currently-running processes
    pub fn running() -> io::Result<Processes> {
        Processes(fs::read_dir("/proc")?)
    }
}

#[cfg(unix)]
struct Processes(fs::ReadDir);

#[cfg(unix)]
impl Iterator for Processes {
    type Item = Process;

    fn next(&mut self) -> Option<Self::Item> {
        self.0
            .flat_map(|entry| entry)
            .filter(|entry| entry.metadata().is_dir())
            .flat_map(|dir| {
                let path = dir.path();
                path.push("status");

                let status = fs::File::open(path).map_err(|_| ())?;
                let reader = io::BufReader::new(status);

                let mut id = None;
                let mut name = None;
                for line in reader.lines() {
                    let line = line.map_err(|_| ())?;
                    if line.starts_with("Name:") {
                        name = Some(line.trim_left_matches("Name:").trim().to_owned());
                    } else if line.starts_with("Pid:") {
                        id = Some(line.trim_left_matches("Pid:").trim().to_owned());
                    }

                    if id.is_some() && name.is_some() {
                        break;
                    }
                }

                let id = id.ok_or(())?
                    .parse::<u32>().map_err(|_| ())?;
                let name = name.ok_or(())?;

                Ok(Process { id: id, name: name })
            })
            .next()
    }
}
