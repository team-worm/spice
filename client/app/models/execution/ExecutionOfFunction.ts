import {Execution, ExecutionStatus } from "./Execution";
import {SourceFunction} from "../SourceFunction";
import { ExecutionId } from "./ExecutionId";
import { SpiceValidator } from "../../util/SpiceValidator";

export class ExecutionOfFunction extends Execution {
	public data: {
			sFunction: SourceFunction; //Function that produced this execution.
	}
	constructor(
		id: ExecutionId,
		status: ExecutionStatus,
		executionTime: number,
		data: { sFunction: SourceFunction }){
		super(id, 'function', status, executionTime, data);

	}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): ExecutionOfFunction {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.sFunction, 'object');

		let sFunction = obj.data.sFunction;
		if(!(sFunction instanceof SourceFunction)) {
			sFunction = SourceFunction.fromObjectStrict(sFunction);
		}

		return new ExecutionOfFunction(obj.id, obj.status, obj.executionTime, { sFunction: sFunction });
	}
}
