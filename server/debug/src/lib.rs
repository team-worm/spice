#![feature(optin_builtin_traits)]
#![feature(field_init_shorthand)]
#![feature(associated_consts)]

extern crate winapi;
extern crate kernel32;
extern crate dbghelp;

#[macro_use]
extern crate lazy_static;

use std::slice;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

pub use process::*;
pub use event::*;
pub use symbol::*;
pub use types::*;

mod process;
mod event;
mod symbol;
mod types;

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
