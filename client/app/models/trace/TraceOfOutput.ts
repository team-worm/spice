import {Trace} from "./Trace";
import { SpiceValidator } from "../../util/SpiceValidator";

export class TraceOfOutput extends Trace {
	constructor(index: number, line: number, data: { output: string }) {
		super(index, 1, line, data);
	}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): TraceOfOutput {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.output, 'string');

		return new TraceOfOutput(obj.index, obj.line, { output: obj.data.output });
	}
}
