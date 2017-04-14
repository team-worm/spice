import { Deserialize } from "../util/SpiceValidator";
export class Value {
	@Deserialize()
	value:  PrimitiveValue | PointerValue | ArrayValue | StructValue;
}

export type PrimitiveValue = boolean | number | null;
export type PointerValue = number;
export type ArrayValue = Value[];
export type StructValue = { [offset: number]: Value };
