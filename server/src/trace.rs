use std::{io, mem, ptr, ops};
use std::cell::RefCell;
use std::collections::HashMap;

use debug;

pub type BreakpointSet = HashMap<usize, RefCell<Option<debug::Breakpoint>>>;

pub struct TraceGuard<'c, 'b> {
    child: &'c debug::Child,
    breakpoints: &'b BreakpointSet,
    owner: bool,
}

impl<'c, 'b> TraceGuard<'c, 'b> {
    pub fn guard(child: &'c debug::Child, breakpoints: &'b BreakpointSet) -> TraceGuard<'c, 'b> {
        TraceGuard { child, breakpoints, owner: false }
    }

    pub fn enable_all(&mut self) -> io::Result<()> {
        for (&address, breakpoint) in self.breakpoints {
            let mut breakpoint = breakpoint.borrow_mut();
            if breakpoint.is_none() {
                *breakpoint = Some(self.child.set_breakpoint(address)?);
                self.owner = true;
            }
        }

        Ok(())
    }
}

impl<'c, 'b> ops::Deref for TraceGuard<'c, 'b> {
    type Target = BreakpointSet;
    fn deref(&self) -> &Self::Target {
        self.breakpoints
    }
}

impl<'c, 'b> Drop for TraceGuard<'c, 'b> {
    fn drop(&mut self) {
        if !self.owner {
            return;
        }

        for (_address, breakpoint) in self.breakpoints {
            let breakpoint = breakpoint.borrow_mut().take();
            if let Some(breakpoint) = breakpoint {
                let _ = self.child.remove_breakpoint(breakpoint);
            }
        }
    }
}

pub struct BreakpointGuard<'a> {
    child: &'a debug::Child,
    breakpoint: Option<debug::Breakpoint>,
}

impl<'a> BreakpointGuard<'a> {
    pub fn new(child: &debug::Child, breakpoint: debug::Breakpoint) -> BreakpointGuard {
        BreakpointGuard { child, breakpoint: Some(breakpoint) }
    }

    pub fn into_inner(self) -> debug::Breakpoint {
        let breakpoint = unsafe { ptr::read(&self.breakpoint) };
        mem::forget(self);

        breakpoint.unwrap()
    }
}

impl<'a> Drop for BreakpointGuard<'a> {
    fn drop(&mut self) {
        if let Some(breakpoint) = self.breakpoint.take() {
            let _ = self.child.remove_breakpoint(breakpoint);
        }
    }
}
