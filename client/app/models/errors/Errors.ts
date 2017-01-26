import { SpiceError } from "./SpiceError";

export class InvalidTypeError extends SpiceError {
	constructor(typeName: string, data?: any) {
		super(1, "InvalidTypeError", `Expected to get type ${ typeName } in this context`, data);
	}
}

export class InvalidValueError extends SpiceError {
	constructor(data: any, message?: string) {
		super(2, "InvalidTypeValue", `The value ${ data } is not valid in this context: ${message}`, data);
	}
}

export class InvalidServerDataError extends SpiceError {
	constructor(typeName: string, data: any, message = "Server returned invalid data") {
		super(3, "InvalidServerDataError", `Failed to construct ${ typeName }: ${ message }.`, data);
	}
}

export class KeyNotFoundError extends SpiceError {
	constructor(key: string) {
		super(4, "KeyNotFoundError", `Key '${key}' not found`);
	}
}
