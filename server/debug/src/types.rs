use std::ffi::OsString;

pub enum Type {
    Base { base: Primitive, size: usize },
    Pointer { type_index: u32 },
    Array { type_index: u32, count: usize },
    Function { type_index: u32, args: Vec<u32> },
    Struct { name: OsString, size: usize, fields: Vec<Field> },
}

#[derive(Copy, Clone)]
pub enum Primitive {
    Void,
    Bool,
    Int { signed: bool },
    Float,
}

pub struct Field {
    pub name: OsString,
    pub field_type: u32,
    pub offset: u32,
}
