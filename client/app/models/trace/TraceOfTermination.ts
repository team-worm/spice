import {Trace} from "./Trace";
import { SpiceValidator } from "../../util/SpiceValidator";

export type TraceOfTerminationData = {
	cause: string; //Reason for termination. Either `stopped`, `crashed`, `ended`, or `breakpoint`.
	stack: string; //(defined if cause=crashed): Stack trace output.
	returnValue: number; //(defined if cause=ended): Function return value or program exit code.
	nextExecution: string; //(defined if cause=breakpoint): Id of the following function execution
};

export class TraceOfTermination extends Trace {
	constructor(
    index: number,
    line: number,
    data: TraceOfTerminationData) {
    	super(index, 2, line, data);
	}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): TraceOfTermination {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.cause, 'string');
		SpiceValidator.assertTypeofStrict(obj.data.stack, 'string');
		SpiceValidator.assertTypeofStrict(obj.data.returnValue, 'number');
		SpiceValidator.assertTypeofStrict(obj.data.nextExecution, 'string');

		return new TraceOfTermination(obj.index, obj.line, {
			cause: obj.data.cause, stack: obj.data.stack, returnValue: obj.data.returnValue, nextExecution: obj.data.nextExecution});
	}
}
