use std::{io, ptr, mem};
use std::collections::HashMap;

use debug;

pub struct Trace<'a> {
    child: &'a mut debug::Child,
    breakpoints: Breakpoints,
}

type Breakpoints = HashMap<usize, Option<debug::Breakpoint>>;

impl<'a> Trace<'a> {
    pub fn create(child: &mut debug::Child) -> Trace {
        Trace { child, breakpoints: Breakpoints::default() }
    }

    pub fn resume(child: &mut debug::Child, breakpoints: Breakpoints) -> Trace {
        Trace { child, breakpoints }
    }

    pub fn child(&mut self) -> &debug::Child {
        let Trace { ref child, .. } = *self;
        &*child
    }

    pub fn set_breakpoint(&mut self, address: usize) -> io::Result<()> {
        let breakpoint = self.child.set_breakpoint(address)?;
        self.breakpoints.insert(address, Some(breakpoint));

        Ok(())
    }

    pub fn take_breakpoint(&mut self, address: usize) -> Option<debug::Breakpoint> {
        self.breakpoints.get_mut(&address).and_then(Option::take)
    }

    pub fn remove_breakpoint(&mut self, breakpoint: debug::Breakpoint) -> io::Result<()> {
        self.child.remove_breakpoint(breakpoint)
    }

    pub fn commit(self) -> Breakpoints {
        let breakpoints = unsafe { ptr::read(&self.breakpoints) };
        mem::forget(self);

        breakpoints
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
