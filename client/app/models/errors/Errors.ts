import { SpiceError } from "./SpiceError";

export class InvalidTypeError extends SpiceError {
	constructor(typeName: string, data?: any) {
		super(1, "InvalidTypeError", `Expected to get type ${ typeName } in this context`, data);
	}
}
