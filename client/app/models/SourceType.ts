import { Deserialize } from "../util/SpiceValidator";
import {Value} from "./Value";

export type SourceTypeId = number;

export class SourceType {
    @Deserialize()
    id: SourceTypeId;

    @Deserialize()
    data: PrimitiveType | PointerType | ArrayType | FunctionType | StructType;

    public toString(typeMap:Map<SourceTypeId, SourceType>):string {
    	try {
			switch(this.data.tType) {
				case 'primitive':
					return this.data.base;
				case 'pointer':
					return (typeMap.get(this.data.sType)!.toString(typeMap) + '*');
				case 'array':
					return (typeMap.get(this.data.sType)!.toString(typeMap) + '[]');
				case 'function':
					let str:string = '( ';
					let first:boolean = true;

					let params:number[] = this.data.parameters;
					for(let par of params){
						if(first) {
							first = false;
						} else {
							str += ' , ';
						}
						let parType = typeMap.get(par)!;
						str += parType.toString(typeMap);
					}
					str += ' )';

					return (str + ' -> ' + typeMap.get(this.data.sType));
				case 'struct':
					return this.data.name;
				default:
					return 'TypeError';
			}
		} catch (error) {
    		return 'Type Map Error';
		}

	}

	public getDefaultValue():Value {
    	switch(this.data.tType) {
			case "primitive":
				switch(this.data.base) {
					case "void":
						return {value: null};
					case "bool":
						return {value: false};
					default:
						return {value: 0};
				}
			case "pointer":
				return {value: null};
			case "array":
				return {value: []};
			case "struct":
				return {value: {}};
			case "function":
				return {value: null};
		}
	}
}

type PrimitiveBaseType = "void" | "bool" | "int" | "uint" | "float";

export interface PrimitiveType {
	tType: 'primitive';
	base: PrimitiveBaseType;
	size: number;
}
export interface PointerType {
	tType: "pointer";
	sType: number;
}

export interface ArrayType {
	tType: "array";
	sType: number;
	count: number;
}

export interface FunctionType {
	tType: "function";
	callingConvention: number;
	sType: number;
	parameters: number[];
}

export interface StructType {
	tType: "struct";
	name: string;
	size: number;
	fields: Field[];
}

export class Field {
	name: string;
	sType: number;
	offset: number;
}
