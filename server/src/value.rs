use std::io;
use std::collections::{HashMap, VecDeque};
use debug::{self, SymbolHandler};
use api;

/// Convert a byte buffer and its type into an `api::Value` and a list of pointers it contains
///
/// The inverse of `api::Value::into_value`.
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

/// Drain the pointer worklist built by `parse`/`parse_bytes` to build a graph of `api::Value`s
pub fn trace_pointers(
    child: &debug::Child, symbols: &debug::SymbolHandler, module: usize, base: usize,
    pointers: &mut VecDeque<(usize, u32)>, values: &mut HashMap<usize, api::Value>
) {
    while let Some((address, type_index)) = pointers.pop_front() {
        let offset = address.checked_sub(base);
        if
            values.contains_key(&address) ||
            offset.map(|offset| values.contains_key(&offset)).unwrap_or(false)
        {
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

impl debug::IntoValue for api::Value {
    /// Convert an `api::Value` into a byte buffer, its type, and a list of pointers that need to
    /// be fixed up.
    ///
    /// The inverse of `parse` and `trace_pointers`
    fn into_value(
        self, data_type: debug::Type, module: usize, symbols: &debug::SymbolHandler,
        value_offset: usize, offsets: &mut HashMap<usize, usize>,
        pointers: &mut VecDeque<(usize, u32)>
    ) -> io::Result<debug::Value> {
        let mut data = vec![0; data_type.size(symbols, module)];

        use debug::Type::*;
        use debug::Primitive::*;
        match (&data_type, self) {
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

            (&Pointer { type_index }, api::Value::Integer(value)) => {
                offsets.insert(value_offset, value as usize);
                pointers.push_back((value as usize, type_index));
            }

            (&Pointer { .. }, api::Value::Null) => {}

            (&Array { type_index, count }, api::Value::Array(values)) => {
                if count != values.len() {
                    return Err(io::Error::from(io::ErrorKind::InvalidInput));
                }

                let element_type = symbols.type_from_index(module, type_index)?;
                let size = element_type.size(symbols, module);

                for (offset, value) in values.into_iter().enumerate().map(|(i, v)| (i * size, v)) {
                    let data_type = element_type.clone();
                    let data = &mut data[offset..offset + size];

                    let offset = value_offset + offset;
                    let value = value
                        .into_value(data_type, module, symbols, offset, offsets, pointers)?;
                    data.copy_from_slice(&value.data);
                }
            }

            (&Struct { ref fields, .. }, api::Value::Struct(ref mut values)) => {
                for &debug::Field { type_index, offset, .. } in fields {
                    let value = match values.remove(&offset) {
                        Some(value) => value,
                        _ => return Err(io::Error::from(io::ErrorKind::InvalidInput)),
                    };

                    let data_type = symbols.type_from_index(module, type_index)?;

                    let offset = offset as usize;
                    let size = data_type.size(symbols, module);
                    let data = &mut data[offset..offset + size];

                    let offset = value_offset + offset;
                    let value = value
                        .into_value(data_type, module, symbols, offset, offsets, pointers)?;
                    data.copy_from_slice(&value.data);
                }
            }

            _ => return Err(io::Error::from(io::ErrorKind::InvalidInput)),
        }

        Ok(debug::Value { data, data_type, module })
    }
}
