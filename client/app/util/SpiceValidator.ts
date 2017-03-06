import { InvalidTypeError } from "../models/Errors";

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

const propertiesKey = Symbol("fields");

interface DeserializeOptions {
    element?: Constructor<any>;
}

interface Constructor<T> {
    new(): T;
}

interface PropertyType {
    constructor: Constructor<any>;
    element?: Constructor<any>;
}

export function Deserialize(options?: DeserializeOptions) {
    options = options || {};
    const element = options.element;
    return (target: any, key: string) => {
        const constructor = Reflect.getMetadata("design:type", target, key);
        if (constructor == Array && !element) {
            throw new TypeError(`@Deserialize on Array requires element type`);
        }

        if (!target[propertiesKey]) {
            target[propertiesKey] = new Map<string, PropertyType>();
        }
        target[propertiesKey].set(key, { constructor, element });
    }
}

export function fromJSON<T, C extends Constructor<T>>(json: any, target: C, key?: string): T {
    key = key || "";

    let jsonType: Function | null;
    switch (typeof json) {
        case "boolean": jsonType = Boolean; break;
        case "number": jsonType = Number; break;
        case "string": jsonType = String; break;
        case "object": jsonType = json ? json.constructor : null; break;
        case "function": throw new TypeError(`JSON property ${key} is a function`);
        default: throw new TypeError(`missing property ${key}`);
    }

    switch (jsonType) {
    case Boolean:
    case Number:
    case String:
        if (jsonType !== target && jsonType !== null) {
            throw new TypeError(`${key} is a ${jsonType.name}; expected a ${target.name}`);
        }
        // fall through
    case null:
    case Array:
        return json;
    }

    const properties: Map<string, PropertyType> = target.prototype[propertiesKey]; // typescript does not yet emit metadata for interfaces
    // typescript is not quite clever enough to omit this null check
    if (!properties) {
        return json;
    }

    let object = new target();
    for (const [key, { constructor, element }] of properties) {
        switch (constructor) {
        case Array:
            object[key] = json[key].map((e: any) => fromJSON(e, element as Constructor<any>));
            break;

        default:
            object[key] = fromJSON(json[key], constructor, key);
            break;
        }
    }

    return object;
}
