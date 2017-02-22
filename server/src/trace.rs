use std::{io, ptr, mem};
use std::collections::HashMap;

use debug;

pub struct Trace<'a> {
    child: &'a debug::Child,
    breakpoints: Breakpoints,
}

type Breakpoints = HashMap<usize, Option<debug::Breakpoint>>;

impl<'a> Trace<'a> {
    pub fn create(child: &debug::Child) -> Trace {
        Trace { child, breakpoints: Breakpoints::default() }
    }

    pub fn resume(child: &debug::Child, breakpoints: Breakpoints) -> Trace {
        Trace { child, breakpoints }
    }

    pub fn pause(self) -> Breakpoints {
        let breakpoints = unsafe { ptr::read(&self.breakpoints) };
        mem::forget(self);

        breakpoints
    }

    pub fn set_breakpoint(&mut self, address: usize) -> io::Result<()> {
        let breakpoint = self.child.set_breakpoint(address)?;
        self.breakpoints.insert(address, Some(breakpoint));

        Ok(())
    }

    pub fn take_breakpoint(&mut self, address: usize) -> Option<debug::Breakpoint> {
        self.breakpoints.get_mut(&address).and_then(Option::take)
    }
}

impl<'a> Drop for Trace<'a> {
    fn drop(&mut self) {
        for (_address, breakpoint) in self.breakpoints.drain() {
            if let Some(breakpoint) = breakpoint {
                let _ = self.child.remove_breakpoint(breakpoint);
            }
        }
    }
}
