import {Execution, ExecutionStatus } from "./Execution";
import { ExecutionId } from "./ExecutionId";
import { SpiceValidator } from "../../util/SpiceValidator";

export class ExecutionOfProcess extends Execution {
	public data: {
		/*Id of the execution that follows this one. Null until `status=done`.
		 * Initially set to `null`, set when a call to `/debug/execute` hits a breakpoint,
		 * in which case it points to the breakpoint function's execution.*/
		nextExecution: ExecutionId | null;
	}
	
	constructor(
		id: ExecutionId,
		status: ExecutionStatus,
		executionTime: number,
		data: { nextExecution: string}) {
			super(id, 'process', status, executionTime, data);
		}

	public static fromObjectStrictData(obj: any): ExecutionOfProcess {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		SpiceValidator.assertTypeofStrict(obj.data.nextExecution, 'string');

		return new ExecutionOfProcess(obj.id, obj.status, obj.executionTime, obj.data);
	}
}
