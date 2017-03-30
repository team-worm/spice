use std::{mem, io};

use winapi;

use {Child, Context, Value, Type, Primitive, SymbolHandler, Symbol};

pub struct Call {
    return_type: Type,
    context: Option<Context>,
}

impl Call {
    pub fn capture(symbols: &SymbolHandler, function: &Symbol) -> io::Result<Call> {
        let (module, return_type, _) = get_function_types(symbols, function)?;
        let return_type = symbols.type_from_index(module, return_type)?;

        Ok(Call { return_type, context: None })
    }

    pub fn setup(
        child: &Child, symbols: &SymbolHandler,
        context: &mut Context, function: &Symbol, args: Vec<Value>
    ) -> io::Result<Call> {
        let (module, return_type, arg_types) = get_function_types(symbols, function)?;

        let mut args = Iterator::zip(args.iter(), arg_types.into_iter());
        let mut new_context = context.clone();

        let return_type = symbols.type_from_index(module, return_type)?;
        let return_size = return_type.size(symbols, module);
        if return_size > 8 {
            let stack_pointer = new_context.stack_pointer() - return_size;
            new_context.set_stack_pointer(stack_pointer);

            let context = new_context.as_raw_mut();
            context.Rcx = stack_pointer as winapi::DWORD64;
        } else if let Some((arg, arg_type)) = args.next() {
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let (value, float) = write_value(&arg, &arg_type, child, &mut new_context)?;

            let context = new_context.as_raw_mut();
            if !float {
                context.Rcx = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[0].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type)) = args.next() {
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let (value, float) = write_value(&arg, &arg_type, child, &mut new_context)?;

            let context = new_context.as_raw_mut();
            if !float {
                context.Rdx = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[1].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type)) = args.next() {
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let (value, float) = write_value(&arg, &arg_type, child, &mut new_context)?;

            let context = new_context.as_raw_mut();
            if !float {
                context.R8 = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[2].Low = value as winapi::ULONGLONG;
            }
        }

        if let Some((arg, arg_type)) = args.next() {
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let (value, float) = write_value(&arg, &arg_type, child, &mut new_context)?;

            let context = new_context.as_raw_mut();
            if !float {
                context.R9 = value as winapi::DWORD64;
            } else {
                context.FltSave.XmmRegisters[3].Low = value as winapi::ULONGLONG;
            }
        }

        // large values passed by pointer need to be allocated before any stack args
        let mut values = vec![];
        for (arg, arg_type) in args {
            let arg_type = symbols.type_from_index(module, arg_type)?;
            let (value, _) = write_value(&arg, &arg_type, child, &mut new_context)?;
            values.push(value);
        }
        for value in values {
            child.stack_push(&mut new_context, value)?;
        }

        let stack_pointer = new_context.stack_pointer();
        new_context.set_stack_pointer(stack_pointer - 4 * mem::size_of::<u64>());

        let return_address = new_context.instruction_pointer();
        child.stack_push(&mut new_context, return_address)?;

        new_context.set_instruction_pointer(function.address);

        Ok(Call {
            return_type: return_type,
            context: Some(mem::replace(context, new_context))
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
    arg: &Value, arg_type: &Type, child: &Child, context: &mut Context
) -> io::Result<(usize, bool)> {
    if &arg.data_type != arg_type {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "argument types do not match"));
    }

    let float = match *arg_type {
        Type::Base { base: Primitive::Float, .. } => true,
        _ => false,
    };

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
            child.stack_push(context, arg)?;
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
