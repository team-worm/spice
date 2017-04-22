use std::{io, mem, ptr, ops};
use std::cell::RefCell;
use std::collections::HashMap;

use debug;

pub type BreakpointSet = HashMap<usize, RefCell<Option<debug::Breakpoint>>>;

/// A set of per-line breakpoints that may need to be removed as part of error recovery.
///
/// The first `TraceGuard` to call `enable_all` becomes the owner of the breakpoints. Further
/// instances (from recursive executions of the same function) do not own the breakpoints.
///
/// Only the owner removes the breakpoints, thus leaving them active until the last user is done.
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

/// A single breakpoint that needs to be removed as part of error recovery.
pub struct BreakpointGuard<'a> {
    child: &'a debug::Child,

    // `breakpoint` is never `None`, it is only this way to handle the `Drop` implementation
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
