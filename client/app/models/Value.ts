import { Deserialize } from "../util/SpiceValidator";
export class Value {
	@Deserialize()
	value:  PrimitiveValue | PointerValue | ArrayValue | StructValue;

	static getSerialized(val:Value | null):any {
		if(!val) {
			return null;
		}
		if(val.value !== null && typeof val.value === 'object'){
			if(Array.isArray(val.value)) {
				let outArr = [];
				for(let v of <ArrayValue> val.value) {
					outArr.push(Value.getSerialized(v));
				}
				return outArr;
			} else {
				let outObj = {};
				for(let k of Object.keys(val.value)) {

					outObj[k] = Value.getSerialized((<StructValue> val.value)[k]);
				}
				return outObj;
			}
		} else {
			return val.value;
		}
	}

	static deserialize(val:any):Value {
		if(val !== null && typeof val === 'object') {
			if(Array.isArray((val))) {
				return { value: val.map((v:any) => Value.deserialize(v))};
			}
			else {
				return {value : Object.keys(val).reduce((o, v) => { o[v] = Value.deserialize(val[v]); return o}, {})};
			}
		}
		return {value: val};
	}

}

export type PrimitiveValue = boolean | number | null;
export type PointerValue = number;
export type ArrayValue = Value[];
export type StructValue = { [offset: number]: Value };
