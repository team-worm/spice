#![feature(optin_builtin_traits)]
#![feature(associated_consts)]

///! # Spice debug library
///!
///! This crate should contain (but does not, yet) all the platform-specific debugging code used by
///! Spice. It should be possible to port Spice to another platform solely by providing another
///! implementation of this code.

extern crate winapi;
extern crate kernel32;
extern crate dbghelp;
extern crate advapi32;

#[macro_use]
extern crate lazy_static;

use std::{mem, slice};
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

pub use process::*;
pub use event::*;
pub use symbol::*;
pub use types::*;
pub use value::*;
pub use call::*;

mod process;
mod event;
mod symbol;
mod types;
mod value;
mod call;

trait FromWide where Self: Sized {
    fn from_wide(wide: &[u16]) -> Self;

    fn from_wide_null(wide: &[u16]) -> Self {
        let len = wide.iter().take_while(|&&c| c != 0).count();
        Self::from_wide(&wide[..len])
    }

    unsafe fn from_wide_raw(wide: *const u16) -> Self {
        let mut len = 0;
        while *wide.offset(len as isize) != 0 { len += 1; }
        let wide = slice::from_raw_parts(wide, len);
        Self::from_wide(wide)
    }

    unsafe fn from_wide_raw_len(wide: *const u16, len: usize) -> Self {
        let wide = slice::from_raw_parts(wide, len);
        Self::from_wide(wide)
    }
}

impl FromWide for OsString {
    fn from_wide(wide: &[u16]) -> OsString {
        OsStringExt::from_wide(wide)
    }
}

pub trait AsBytes: Sized {
    fn as_bytes(&self) -> &[u8] {
        unsafe { slice::from_raw_parts(self as *const _ as *const _, mem::size_of::<Self>()) }
    }
}

impl AsBytes for bool {}

impl AsBytes for usize {}
impl AsBytes for u64 {}
impl AsBytes for u32 {}
impl AsBytes for u16 {}
impl AsBytes for u8 {}

impl AsBytes for isize {}
impl AsBytes for i64 {}
impl AsBytes for i32 {}
impl AsBytes for i16 {}
impl AsBytes for i8 {}

impl AsBytes for f32 {}
impl AsBytes for f64 {}

impl<'a> AsBytes for &'a Value {
    fn as_bytes(&self) -> &[u8] {
        &self.data
    }
}
