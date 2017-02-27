use std::{io, ptr, mem};
use std::cell::RefCell;
use std::collections::HashMap;

use debug;

pub struct TraceGuard<'a> {
    child: &'a debug::Child,
    breakpoints: BreakpointSet,
}

pub type BreakpointSet = HashMap<usize, RefCell<Option<debug::Breakpoint>>>;

impl<'a> TraceGuard<'a> {
    pub fn new(child: &debug::Child) -> TraceGuard {
        TraceGuard { child, breakpoints: BreakpointSet::default() }
    }

    pub fn from_set(child: &debug::Child, breakpoints: BreakpointSet) -> TraceGuard {
        TraceGuard { child, breakpoints }
    }

    pub fn set_breakpoint(&mut self, address: usize) -> io::Result<()> {
        let breakpoint = self.child.set_breakpoint(address)?;
        self.breakpoints.insert(address, RefCell::new(Some(breakpoint)));

        Ok(())
    }

    pub fn into_inner(self) -> BreakpointSet {
        let breakpoints = unsafe { ptr::read(&self.breakpoints) };
        mem::forget(self);

        breakpoints
    }
}

impl<'a> Drop for TraceGuard<'a> {
    fn drop(&mut self) {
        for (_address, breakpoint) in self.breakpoints.drain() {
            if let Some(breakpoint) = breakpoint.into_inner() {
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
