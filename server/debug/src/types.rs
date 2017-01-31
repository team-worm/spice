use std::mem;
use std::ffi::OsString;

use SymbolHandler;

#[derive(Clone, PartialEq, Eq)]
pub enum Type {
    Base { base: Primitive, size: usize },
    Pointer { type_index: u32 },
    Array { type_index: u32, count: usize },
    Function { calling_convention: u32, type_index: u32, args: Vec<u32> },
    Struct { name: OsString, size: usize, fields: Vec<Field> },
}

#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Primitive {
    Void,
    Bool,
    Int { signed: bool },
    Float,
}

#[derive(Clone, PartialEq, Eq)]
pub struct Field {
    pub name: OsString,
    pub type_index: u32,
    pub offset: u32,
}

impl Type {
    pub fn size(&self, symbols: &SymbolHandler, module: usize) -> usize {
        use Type::*;
        match *self {
            Base { size, .. } => size,
            Pointer { .. } | Function { .. } => mem::size_of::<usize>(),
            Array { type_index, count } => {
                let element_type = symbols.type_from_index(module, type_index).unwrap();
                element_type.size(symbols, module) * count
            }
            Struct { size, .. } => size,
        }
    }
}
