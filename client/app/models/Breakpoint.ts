import {SourceFunction} from "./SourceFunction";
import { SpiceValidator } from "../util/SpiceValidator";
import {SourceFunctionId} from "./SourceFunctionId";

export class Breakpoint {
	constructor(
		public sFunction: SourceFunctionId, //The function that this is breakpoint is associated with.
		public metadata: string //Any additional info associated with this breakpoint.
	) {
	}

	public static fromObjectStrict(obj: any): Breakpoint {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.metadata, 'string');
		SpiceValidator.assertTypeofStrict(obj.sFunction, 'number');  //TODO: rename this to sFunction on backend
		obj.sFunction = obj.sFunction.toString();

		return new Breakpoint(obj.sFunction, obj.metadata);
	}
}
