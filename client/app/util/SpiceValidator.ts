
import { InvalidTypeError } from "../models/errors/Errors";

export class SpiceValidator {
	/** Throws InvalidTypeError if val is not typeof typeName, or val is undefined or null */
	static assertTypeofStrict(val: any, typeName: string): void {
		if(val === null || val === undefined || typeof val !== typeName) {
			throw new InvalidTypeError(typeName, val);
		}
	}

	/** Throws InvalidTypeError if val is not array, or val is undefined or null */
	static assertArrayStrict(val: any): void {
		if(val === null || val === undefined || val.constructor !== Array) {
			throw new InvalidTypeError('array', val);
		}
	}
}
