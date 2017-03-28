use std::io;
use std::convert::{TryFrom, TryInto};
use std::collections::HashMap;
use debug::{self, SymbolHandler};
use api;

pub struct Parse<'a, 'b, 'c>(&'a [u8], &'b debug::Type, &'c SymbolHandler, usize);

pub fn parse<'a, 'b>(value: &'a debug::Value, symbols: &'b SymbolHandler) -> Parse<'a, 'a, 'b> {
    Parse(&value.data, &value.data_type, symbols, value.module)
}

impl<'a, 'b, 'c> From<Parse<'a, 'b, 'c>> for api::Value {
    fn from(value: Parse) -> api::Value {
        let Parse(data, data_type, symbols, module) = value;

        let value = data.as_ptr();

        use debug::Type::*;
        match *data_type {
            Base { base, size } => {
                use debug::Primitive::*;
                match base {
                    Void => api::Value::Null,
                    Bool => api::Value::Boolean(unsafe { *(value as *const bool) }),
                    Int { signed: true } => match size {
                        1 => api::Value::Integer(unsafe { *(value as *const i8) } as i64),
                        2 => api::Value::Integer(unsafe { *(value as *const i16) } as i64),
                        4 => api::Value::Integer(unsafe { *(value as *const i32) } as i64),
                        8 => api::Value::Integer(unsafe { *(value as *const i64) } as i64),
                        _ => unreachable!(),
                    },
                    Int { signed: false } => match size {
                        1 => api::Value::Integer(unsafe { *(value as *const u8) } as i64),
                        2 => api::Value::Integer(unsafe { *(value as *const u16) } as i64),
                        4 => api::Value::Integer(unsafe { *(value as *const u32) } as i64),
                        8 => api::Value::Integer(unsafe { *(value as *const u64) } as i64),
                        _ => unreachable!(),
                    },
                    Float => match size {
                        4 => api::Value::Number(unsafe { *(value as *const f32) } as f64),
                        8 => api::Value::Number(unsafe { *(value as *const f64) } as f64),
                        _ => unreachable!(),
                    },
                }
            }

            Pointer { .. } => {
                api::Value::Integer(unsafe { *(value as *const u64) } as i64)
            }

            Array { type_index, count } => {
                let element_type = symbols.type_from_index(module, type_index)
                    .expect("corrupt element type");
                let size = element_type.size(symbols, module);

                let mut values = vec![];
                for offset in (0..count).map(|i| i * size) {
                    let data = &data[offset..offset+size];

                    let value = Parse(data, &element_type, symbols, module).into();
                    values.push(value);
                }

                api::Value::Array(values)
            }

            Struct { ref fields, .. } => {
                let mut values = HashMap::new();
                for &debug::Field { type_index, offset, .. } in fields {
                    let field_type = symbols.type_from_index(module, type_index)
                        .expect("corrupt field type");

                    let offset = offset as usize;
                    let size = field_type.size(symbols, module);
                    let data = &data[offset..offset + size];

                    let value = Parse(data, &field_type, symbols, module).into();
                    values.insert(offset as u32, value);
                }

                api::Value::Struct(values)
            }

            _ => api::Value::Null,
        }
    }
}

pub struct Write<'a>(api::Value, debug::Type, usize, &'a SymbolHandler);

pub fn write<'a>(
    value: api::Value, data_type: debug::Type, module: usize, symbols: &'a SymbolHandler
) -> Write<'a> {
    Write(value, data_type, module, symbols)
}

impl<'a> TryFrom<Write<'a>> for debug::Value {
    type Error = io::Error;

    fn try_from(write: Write) -> Result<Self, Self::Error> {
        let Write(value, data_type, module, symbols) = write;

        let mut data = vec![0; data_type.size(symbols, module)];

        use debug::Type::*;
        use debug::Primitive::*;
        match (&data_type, value) {
            (&Base { base: Void, .. }, api::Value::Null) => {}

            (&Base { base: Bool, .. }, api::Value::Boolean(value)) => {
                unsafe { *(data.as_mut_ptr() as *mut bool) = value };
            }

            (&Base { base: Int { signed }, size }, api::Value::Integer(value)) => {
                if signed {
                    match size {
                        1 => unsafe { *(data.as_mut_ptr() as *mut i8) = value as i8 },
                        2 => unsafe { *(data.as_mut_ptr() as *mut i16) = value as i16 },
                        4 => unsafe { *(data.as_mut_ptr() as *mut i32) = value as i32 },
                        8 => unsafe { *(data.as_mut_ptr() as *mut i64) = value as i64 },
                        _ => unreachable!(),
                    }
                } else {
                    match size {
                        1 => unsafe { *(data.as_mut_ptr() as *mut u8) = value as u8 },
                        2 => unsafe { *(data.as_mut_ptr() as *mut u16) = value as u16 },
                        4 => unsafe { *(data.as_mut_ptr() as *mut u32) = value as u32 },
                        8 => unsafe { *(data.as_mut_ptr() as *mut u64) = value as u64 },
                        _ => unreachable!(),
                    }
                }
            }

            // TODO: this needs to tie into call stack setup and address remapping
            (&Pointer { .. }, api::Value::Integer(value)) => {
                unsafe { *(data.as_mut_ptr() as *mut usize) = value as usize };
            }

            (&Array { type_index, count }, api::Value::Array(values)) => {
                if count != values.len() {
                    return Err(io::Error::from(io::ErrorKind::InvalidInput));
                }

                let element_type = symbols.type_from_index(module, type_index)?;
                let size = element_type.size(symbols, module);

                for (offset, value) in values.into_iter().enumerate().map(|(i, v)| (i * size, v)) {
                    let data = &mut data[offset..offset+size];
                    let value: debug::Value = Write(value, element_type.clone(), module, symbols)
                        .try_into()?;
                    data.copy_from_slice(&value.data);
                }
            }

            (&Struct { ref fields, .. }, api::Value::Struct(ref mut values)) => {
                for &debug::Field { type_index, offset, .. } in fields {
                    let value = match values.remove(&offset) {
                        Some(value) => value,
                        _ => return Err(io::Error::from(io::ErrorKind::InvalidInput)),
                    };

                    let field_type = symbols.type_from_index(module, type_index)?;

                    let offset = offset as usize;
                    let size = field_type.size(symbols, module);
                    let data = &mut data[offset..offset + size];

                    let value: debug::Value = Write(value, field_type, module, symbols)
                        .try_into()?;
                    data.copy_from_slice(&value.data);
                }
            }

            _ => return Err(io::Error::from(io::ErrorKind::InvalidInput)),
        }

        Ok(debug::Value { data, data_type, module })
    }
}
