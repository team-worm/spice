import { InvalidValueError } from "../errors/Errors";
import { SpiceValidator } from "../../util/SpiceValidator";
import { Trace } from "./Trace";
import { TraceOfIntruction } from "./TraceOfIntruction";
import { TraceOfOutput } from "./TraceOfOutput";
import { TraceOfTermination } from "./TraceOfTermination";

export class TraceFactory {
	public static fromObjectStrict(obj: any): Trace {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.tType, 'number');
		SpiceValidator.assertTypeofStrict(obj.index, 'number');
		SpiceValidator.assertTypeofStrict(obj.line, 'number');

		switch(obj.tType) {
			case 0:
				return TraceOfIntruction.fromObjectStrictData(obj);
			case 1:
				return TraceOfOutput.fromObjectStrictData(obj);
			case 2:
				return TraceOfTermination.fromObjectStrictData(obj);
			default:
				throw new InvalidValueError(obj.tType, 'Trace tType must have value 0, 1, or 2');
		}
	}
}
