import { Deserialize } from "../util/SpiceValidator";
export class Value {
	@Deserialize()
	value:  PrimitiveValue | PointerValue | ArrayValue | StructValue;
}

export type PrimitiveValue = boolean | number | null;
export type PointerValue = boolean | number | null;
export type ArrayValue = Value[];
export type StructValue = { number: Value };
