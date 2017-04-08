use std::{mem, io};
use std::collections::{HashMap, VecDeque};

use winapi;

use AsBytes;
use {Child, Context, Value, Type, Primitive, SymbolHandler, Symbol};

pub struct Call {
    return_type: Type,
    context: Option<Context>,
}

pub trait IntoValue {
    fn into_value(
        self, data_type: Type, module: usize, symbols: &SymbolHandler,
        value_offset: usize, offsets: &mut HashMap<usize, usize>,
        pointers: &mut VecDeque<(usize, u32)>
    ) -> io::Result<Value>;
}

impl Call {
    pub fn capture(symbols: &SymbolHandler, function: &Symbol) -> io::Result<Call> {
        let (module, return_type, _) = get_function_types(symbols, function)?;
        let return_type = symbols.type_from_index(module, return_type)?;

        Ok(Call { return_type, context: None })
    }

    pub fn setup<A: IntoValue>(
        child: &Child, symbols: &SymbolHandler,
        old_context: &mut Context, function: &Symbol, mut arg_values: HashMap<usize, A>
    ) -> io::Result<Call> {
        let (module, return_type, arg_types) = get_function_types(symbols, function)?;
        let mut arg_offsets = vec![];
        symbols.enumerate_locals(function.address, |symbol, _| {
            if symbol.flags & winapi::SYMFLAG_PARAMETER != 0 {
                arg_offsets.push(symbol.address);
            }
            true
        })?;

        let mut addresses = HashMap::new();
        let mut offsets = HashMap::new();
        let mut pointers = VecDeque::new();

        // remove direct arguments from the map before writing indirect values
        let mut args = vec![];
        for (offset, arg_type) in Iterator::zip(arg_offsets.into_iter(), arg_types.into_iter()) {
            let mut offsets = HashMap::new();
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let arg_value = arg_values.remove(&offset)
                .ok_or(io::Error::from(io::ErrorKind::InvalidInput))?
                .into_value(arg_type.clone(), module, symbols, 0, &mut offsets, &mut pointers)?;
            args.push((arg_value, arg_type, offsets));
        }

        let mut context = old_context.clone();

        // write indirect values to the stack
        while let Some((offset, type_index)) = pointers.pop_front() {
            if addresses.contains_key(&offset) {
                continue;
            }

            let mut arg_offsets = HashMap::new();
            let arg_type = symbols.type_from_index(module, type_index)?;
            let arg_value = arg_values.remove(&offset)
                .ok_or(io::Error::from(io::ErrorKind::InvalidInput))?
                .into_value(arg_type.clone(), module, symbols, 0, &mut arg_offsets, &mut pointers)?;
            child.stack_push(&mut context, &arg_value)?;

            let address = context.stack_pointer();
            addresses.insert(offset, address);

            let arg_offsets = arg_offsets.into_iter()
                .map(|(offset, value)| (address + offset, value));
            offsets.extend(arg_offsets);
        }

        // fixup pointers to their actual targets
        addresses.insert(0, 0);
        for (&address, &target) in &offsets {
            let bytes = addresses[&target].as_bytes();
            child.write_memory(address, bytes)?;
        }

        // write direct arguments to registers and the stack

        let mut args = args.into_iter();

        let return_type = symbols.type_from_index(module, return_type)?;
        let return_size = return_type.size(symbols, module);
        if return_size > 8 {
            let stack_pointer = context.stack_pointer() - return_size;
            context.set_stack_pointer(stack_pointer);

            let context = context.as_raw_mut();
            context.Rcx = stack_pointer as winapi::DWORD64;
        } else if let Some((arg, arg_type, offsets)) = args.next() {
            let (value, float) = write_value(
                arg, &arg_type, child, &mut context, &addresses, &offsets
            )?;

            let context = context.as_raw_mut();
            if !float {
                context.Rcx = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[0].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type, offsets)) = args.next() {
            let (value, float) = write_value(
                arg, &arg_type, child, &mut context, &addresses, &offsets
            )?;

            let context = context.as_raw_mut();
            if !float {
                context.Rdx = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[1].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type, offsets)) = args.next() {
            let (value, float) = write_value(
                arg, &arg_type, child, &mut context, &addresses, &offsets
            )?;

            let context = context.as_raw_mut();
            if !float {
                context.R8 = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[2].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type, offsets)) = args.next() {
            let (value, float) = write_value(
                arg, &arg_type, child, &mut context, &addresses, &offsets
            )?;

            let context = context.as_raw_mut();
            if !float {
                context.R9 = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[3].Low = value as winapi::ULONGLONG;
            }
        }

        // large values passed by pointer need to be allocated before any stack args
        let mut values = vec![];
        for (arg, arg_type, offsets) in args {
            let (value, _) = write_value(
                arg, &arg_type, child, &mut context, &addresses, &offsets
            )?;
            values.push(value);
        }
        for value in values {
            child.stack_push(&mut context, value)?;
        }

        let stack_pointer = context.stack_pointer();
        context.set_stack_pointer(stack_pointer - 4 * mem::size_of::<u64>());

        let return_address = context.instruction_pointer();
        child.stack_push(&mut context, return_address)?;

        context.set_instruction_pointer(function.address);

        Ok(Call {
            return_type: return_type,
            context: Some(mem::replace(old_context, context))
        })
    }

    pub fn teardown(
        self, child: &Child, context: &Context, symbols: &SymbolHandler
    ) -> io::Result<(Value, Option<Context>)> {
        let value = Value::read_return(child, context.as_raw(), symbols, self.return_type)?;
        Ok((value, self.context))
    }

    pub fn cancel(self) -> Option<Context> {
        self.context
    }
}

fn get_function_types(symbols: &SymbolHandler, function: &Symbol) ->
    io::Result<(usize, u32, Vec<u32>)>
{
    let module = symbols.module_from_address(function.address)?;
    let function_type = symbols.type_from_index(module, function.type_index)?;
    let (calling_convention, return_type, arg_types) = match function_type {
        Type::Function { calling_convention, type_index, args } => {
            (calling_convention, type_index, args)
        }
        _ => return Err(io::Error::new(io::ErrorKind::InvalidInput, "cannot call a non-function")),
    };

    if calling_convention != 0 { // CV_CALL_NEAR_C
        return Err(io::Error::new(io::ErrorKind::InvalidData, "unsupported calling convention"));
    }

    Ok((module, return_type, arg_types))
}

fn write_value(
    mut arg: Value, arg_type: &Type, child: &Child, context: &mut Context,
    addresses: &HashMap<usize, usize>, offsets: &HashMap<usize, usize>
) -> io::Result<(usize, bool)> {
    if &arg.data_type != arg_type {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "argument types do not match"));
    }

    let float = match *arg_type {
        Type::Base { base: Primitive::Float, .. } => true,
        _ => false,
    };

    for (&offset, &target) in offsets {
        let bytes = addresses[&target].as_bytes();
        arg.data[offset..bytes.len()].copy_from_slice(bytes);
    }

    let value = arg.data.as_ptr();
    let value = match *arg_type {
        Type::Base { .. } | Type::Pointer { .. } | Type::Struct { .. }
        if arg.data.len() <= 8 => {
            match arg.data.len() {
                1 => unsafe { *(value as *const u8) as usize },
                2 => unsafe { *(value as *const u16) as usize },
                4 => unsafe { *(value as *const u32) as usize },
                8 => unsafe { *(value as *const u64) as usize },
                _ => unreachable!(),
            }
        }

        Type::Struct { .. } if arg.data.len() > 8 => {
            child.stack_push(context, &arg)?;
            context.stack_pointer()
        }

        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput, "cannot pass a dynamically sized value"
            ));
        }
    };

    Ok((value, float))
}
