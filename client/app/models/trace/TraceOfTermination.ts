import {Trace} from "./Trace";
import { SpiceValidator } from "../../util/SpiceValidator";
import { InvalidValueError } from "../errors/Errors";

export type TraceOfTerminationData = {
	cause: 'stopped' | 'crashed' | 'ended' | 'breakpoint'; //Reason for termination. Either `stopped`, `crashed`, `ended`, or `breakpoint`.
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

	public static assertTraceCause(cause: string) {
		if(['stopped', 'crashed', 'ended', 'breakpoint'].indexOf(cause) === -1) {
			throw new InvalidValueError(cause);
		}
	}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): TraceOfTermination {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.cause, 'string');
		TraceOfTermination.assertTraceCause(obj.data.cause);
		switch(obj.data.cause) {
			case 'crashed':
				SpiceValidator.assertTypeofStrict(obj.data.stack, 'string');
				break;
			case 'ended':
				SpiceValidator.assertTypeofStrict(obj.data.returnValue, 'number');
				break;
			case 'breakpoint':
				SpiceValidator.assertTypeofStrict(obj.data.nextExecution, 'string');
				break;
		}

		return new TraceOfTermination(obj.index, obj.line, {
			cause: obj.data.cause, stack: obj.data.stack, returnValue: obj.data.returnValue, nextExecution: obj.data.nextExecution});
	}
}
