import { Deserialize } from "../util/SpiceValidator";

export type SourceTypeId = number;

export class SourceType {
    @Deserialize()
    id: SourceTypeId;

    @Deserialize()
    data: PrimitiveType | PointerType | ArrayType | FunctionType | StructType;
}

type PrimitiveBaseType = "void" | "bool" | "int" | "uint" | "float";

interface PrimitiveType {
	tType: 'primitive';
	base: PrimitiveBaseType;
	size: number;
}
interface PointerType {
	tType: "pointer";
	sType: number;
}

interface ArrayType {
	tType: "array";
	sType: number;
	count: number;
}

interface FunctionType {
	tType: "function";
	callingConvention: number;
	sType: number;
	parameters: number[];
}

interface StructType {
	tType: "struct";
	name: string;
	size: number;
	fields: Field[];
}

class Field {
	name: string;
	sType: number;
	offset: number;
}
