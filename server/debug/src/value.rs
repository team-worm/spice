use std::{ptr, io, fmt};
use {Child, SymbolHandler, Symbol, Context, Type, Primitive, Field, AsBytes};

use winapi;

/// A byte buffer and its type, which describes how to interpret it.
///
/// Either taken from the address space of the target program, or
/// intended to be written to the address space of the target program.
pub struct Value {
    pub data: Vec<u8>,
    pub data_type: Type,
    pub module: usize,
}

impl Value {
    pub fn new<B: AsBytes>(data: B, data_type: Type) -> Value {
        Value { data: data.as_bytes().into(), data_type: data_type, module: 0 }
    }

    /// Read a value from an absolute address.
    pub fn read_pointer(
        child: &Child, symbols: &SymbolHandler, address: usize, module: usize, type_index: u32
    ) -> io::Result<Value> {
        let data_type = symbols.type_from_index(module, type_index)?;

        let mut data = vec![0u8; data_type.size(symbols, module)];
        child.read_memory(address, &mut data)?;

        Ok(Value { data, data_type, module })
    }

    /// Read a value via a symbol, which can be a function local or argument.
    pub fn read_symbol(
        child: &Child, context: &Context, symbols: &SymbolHandler, symbol: &Symbol
    ) -> io::Result<Value> {
        let context = context.as_raw();

        let regrel = symbol.flags & winapi::SYMFLAG_REGREL != 0;
        let parameter = symbol.flags & winapi::SYMFLAG_PARAMETER != 0;
        let _register = symbol.flags & winapi::SYMFLAG_REGISTER != 0; // TODO: read from regs?

        let module_address = if regrel { context.Rip as usize } else { symbol.address };
        let module = symbols.module_from_address(module_address)?;
        let data_type = symbols.type_from_index(module, symbol.type_index)?;

        let address = if regrel {
            let address = context.Rbp as usize + symbol.address;
            if let (&Type::Struct { .. }, true) = (&data_type, parameter && symbol.size > 8) {
                let mut buffer = [0u8; 8]; // TODO: mem::size_of::<usize>()
                child.read_memory(address, &mut buffer)?;
                unsafe { *(buffer.as_ptr() as *const usize) }
            } else {
                address
            }
        } else {
            symbol.address
        };

        let mut data = vec![0u8; symbol.size];
        child.read_memory(address, &mut data)?;

        Ok(Value { data, data_type, module })
    }

    /// Read a value that was returned from a function.
    pub fn read_return(
        child: &Child, context: &winapi::CONTEXT, symbols: &SymbolHandler, data_type: Type
    ) -> io::Result<Value> {
        let module = symbols.module_from_address(context.Rip as usize)?;
        let data_size = data_type.size(symbols, module);

        let float = match data_type {
            Type::Base { base: Primitive::Float, .. } => true,
            _ => false,
        };

        let mut data = vec![0u8; data_size];
        match data_type {
            Type::Base { .. } | Type::Pointer { .. } | Type::Struct { .. } if data_size <= 8 => {
                let source = if !float {
                    &context.Rax as *const _ as *const u8
                } else {
                    &context.FltSave.XmmRegisters[0].Low as *const _ as *const u8
                };
                unsafe { ptr::copy(source, data.as_mut_ptr(), data.len()) };
            }

            Type::Struct { .. } if data_size > 8 => {
                child.read_memory(context.Rax as usize, &mut data)?;
            }

            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::Other, "cannot return a dynamically sized value"
                ));
            }
        }

        Ok(Value { data, data_type, module })
    }

    pub fn display<'a, 'b>(&'a self, symbols: &'b SymbolHandler) -> ValueDisplay<'a, 'a, 'b> {
        ValueDisplay(&self.data, &self.data_type, symbols, self.module)
    }
}

pub struct ValueDisplay<'a, 'b, 'c>(&'a [u8], &'b Type, &'c SymbolHandler, usize);

impl<'a, 'b, 'c> fmt::Display for ValueDisplay<'a, 'b, 'c> {
    fn fmt(&self, fmt: &mut fmt::Formatter) -> Result<(), fmt::Error> {
        let ValueDisplay(data, data_type, symbols, module) = *self;

        let value = data.as_ptr();

        use Type::*;
        match *data_type {
            Base { base, size } => {
                use Primitive::*;
                match base {
                    Void => write!(fmt, "void"),
                    Bool => write!(fmt, "{}", unsafe { *(value as *const bool) }),
                    Int { signed: true } => match size {
                        1 => write!(fmt, "{}", unsafe { *(value as *const i8) }),
                        2 => write!(fmt, "{}", unsafe { *(value as *const i16) }),
                        4 => write!(fmt, "{}", unsafe { *(value as *const i32) }),
                        8 => write!(fmt, "{}", unsafe { *(value as *const i64) }),
                        _ => unreachable!(),
                    },
                    Int { signed: false } => match size {
                        1 => write!(fmt, "{}", unsafe { *(value as *const u8) }),
                        2 => write!(fmt, "{}", unsafe { *(value as *const u16) }),
                        4 => write!(fmt, "{}", unsafe { *(value as *const u32) }),
                        8 => write!(fmt, "{}", unsafe { *(value as *const u64) }),
                        _ => unreachable!(),
                    },
                    Float => match size {
                        4 => write!(fmt, "{}", unsafe { *(value as *const f32) }),
                        8 => write!(fmt, "{}", unsafe { *(value as *const f64) }),
                        _ => unreachable!(),
                    },
                }
            }

            Pointer { .. } => {
                write!(fmt, "0x{:x}", unsafe { *(value as *const u64) })
            }

            Array { type_index, count } => {
                let element_type = symbols.type_from_index(module, type_index)
                    .map_err(|_| fmt::Error)?;
                let size = element_type.size(symbols, module);

                write!(fmt, "[")?;
                for offset in (0..count).map(|i| i * size) {
                    let data = &data[offset..offset+size];

                    let value = ValueDisplay(data, &element_type, symbols, module);
                    write!(fmt, "{}, ", value)?;
                }
                write!(fmt, "]")?;

                Ok(())
            }

            Struct { ref name, ref fields, .. } => {
                write!(fmt, "{} {{ ", name.to_string_lossy())?;
                for &Field { ref name, type_index, offset } in fields {
                    let field_type = symbols.type_from_index(module, type_index)
                        .map_err(|_| fmt::Error)?;

                    let offset = offset as usize;
                    let size = field_type.size(symbols, module);
                    let data = &data[offset..offset + size];

                    let value = ValueDisplay(data, &field_type, symbols, module);
                    write!(fmt, "{}: {}, ", name.to_string_lossy(), value)?;
                }
                write!(fmt, "}}")?;

                Ok(())
            }

            _ => write!(fmt, "?"),
        }
    }
}
