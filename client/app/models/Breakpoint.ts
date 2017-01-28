import {SourceFunction} from "./SourceFunction";
import { SpiceValidator } from "../util/SpiceValidator";

export class Breakpoint {
	constructor(
		public sFunction: SourceFunction, //The function that this is breakpoint is associated with.
		public metadata: string //Any additional info associated with this breakpoint.
	) {
	}

	public static fromObjectStrict(obj: any): Breakpoint {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.metadata, 'string');

		let sFunction = SourceFunction.fromObjectStrict(obj.sFunction);

		return new Breakpoint(sFunction, obj.metadata);
	}
}
