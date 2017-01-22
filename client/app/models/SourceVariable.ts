import {SourceType} from "./SourceType";
import { SpiceValidator } from "../util/SpiceValidator";

export class SourceVariable {

	constructor(
		public id: string, //Unique identifier of that variable.
		public name: string, //Name of the variable as it appears in the function.
		public sType: SourceType, //Type of the variable as it is defined in the source code.
		public address: number //Memory address.
	) {
	}

	public static fromObjectStrict(obj: any): SourceVariable {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'string');
		SpiceValidator.assertTypeofStrict(obj.name, 'string');
		SpiceValidator.assertTypeofStrict(obj.sType, 'string');
		SpiceValidator.assertTypeofStrict(obj.address, 'number');

		return new SourceVariable(obj.id, obj.name, obj.sType, obj.address);
	}
}
