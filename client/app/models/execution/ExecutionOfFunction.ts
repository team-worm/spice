import {Execution, ExecutionStatus } from "./Execution";
import {SourceFunction} from "../SourceFunction";
import { ExecutionId } from "./ExecutionId";
import { SpiceValidator } from "../../util/SpiceValidator";

export class ExecutionOfFunction extends Execution {
	public data: {
			sFunction: string; //Function that produced this execution.
	};
	constructor(
		id: ExecutionId,
		status: ExecutionStatus,
		executionTime: number,
		data: { sFunction: string }){
		super(id, 'function', status, executionTime, data);

	}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): ExecutionOfFunction {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.sFunction, 'number');

		return new ExecutionOfFunction(obj.id.toString(), obj.status, obj.executionTime, { sFunction: obj.data.sFunction.toString() });
	}
}
