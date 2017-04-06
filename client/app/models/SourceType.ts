import { Deserialize } from "../util/SpiceValidator";

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
    		console.error('TYPES ERROR', error); //TODO: Clean this up.
    		return '';
		}

	}
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
