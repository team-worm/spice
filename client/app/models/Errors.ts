export class InvalidTypeError extends Error {
	constructor(typeName: string, public data?: any) {
		super(`Expected to get type ${typeName} in this context`);
	}
}

export class InvalidValueError extends Error {
	constructor(data: any, message?: string) {
		super(`The value ${data} is not valid in this context: ${message}`);
	}
}

export class InvalidServerDataError extends Error {
	constructor(typeName: string, public data: any, message = "Server returned invalid data") {
		super(`Failed to construct ${typeName}: ${message}.`);
	}
}

export class KeyNotFoundError extends Error {
	constructor(key: string) {
		super(`Key '${key}' not found`);
	}
}
