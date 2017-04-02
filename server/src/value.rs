use std::io;
use std::convert::{TryFrom, TryInto};
use std::collections::{HashMap, VecDeque};
use debug::{self, SymbolHandler};
use api;

pub fn parse(
    value: &debug::Value, symbols: &SymbolHandler,
    pointers: &mut VecDeque<(usize, u32)>
) -> api::Value {
    parse_bytes(&value.data, &value.data_type, symbols, value.module, pointers)
}

fn parse_bytes(
    data: &[u8], data_type: &debug::Type, symbols: &SymbolHandler, module: usize,
    pointers: &mut VecDeque<(usize, u32)>
) -> api::Value {
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

        Pointer { type_index } => {
            let address = unsafe { *(value as *const usize) };
            pointers.push_back((address, type_index));

            api::Value::Integer(address as i64)
        }

        Array { type_index, count } => {
            let element_type = symbols.type_from_index(module, type_index)
                .expect("corrupt element type");
            let size = element_type.size(symbols, module);

            let mut values = vec![];
            for offset in (0..count).map(|i| i * size) {
                let data = &data[offset..offset+size];

                let value = parse_bytes(data, &element_type, symbols, module, pointers);
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

                let value = parse_bytes(data, &field_type, symbols, module, pointers);
                values.insert(offset as u32, value);
            }

            api::Value::Struct(values)
        }

        _ => api::Value::Null,
    }
}

pub fn trace_pointers(
    child: &debug::Child, symbols: &debug::SymbolHandler, module: usize, base: usize,
    pointers: &mut VecDeque<(usize, u32)>, values: &mut HashMap<usize, api::Value>
) {
    while let Some((address, type_index)) = pointers.pop_front() {
        let offset = address - base;
        if values.contains_key(&address) || values.contains_key(&offset) {
            continue;
        }

        let value = match debug::Value::read_pointer(
            child, symbols, address, module, type_index
        ) {
            Ok(value) => value,
            _ => continue,
        };

        if value.data[0] == 0xcc {
            continue;
        }

        let value = parse(&value, symbols, pointers);
        values.insert(address, value);
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
