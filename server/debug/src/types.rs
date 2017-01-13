pub enum Type {
    Base { base: Primitive, size: usize },
    Pointer { type_index: u32 },
    Array { type_index: u32, count: usize },
    Function { type_index: u32, args: Vec<u32> },
    Struct { name: String, fields: u32 },
}

#[derive(Copy, Clone, Debug)]
pub enum Primitive {
    Void,
    Bool,
    Int { signed: bool },
    Float,
}
