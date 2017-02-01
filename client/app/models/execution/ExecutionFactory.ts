import { Execution } from "./Execution";
import { ExecutionOfFunction } from "./ExecutionOfFunction";
import { ExecutionOfProcess } from "./ExecutionOfProcess";
import { InvalidValueError } from "../errors/Errors";
import { SpiceValidator } from "../../util/SpiceValidator";

export class ExecutionFactory {
	public static fromObjectStrict(obj: any): Execution {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'number');
		SpiceValidator.assertTypeofStrict(obj.eType, 'string');
		SpiceValidator.assertTypeofStrict(obj.status, 'string');
		SpiceValidator.assertTypeofStrict(obj.executionTime, 'number');

		Execution.assertExecutionStatus(obj.status);

		switch(obj.eType) {
			case 'function':
				return ExecutionOfFunction.fromObjectStrictData(obj);
			case 'process':
				return ExecutionOfProcess.fromObjectStrictData(obj);
			default:
				throw new InvalidValueError(obj.eType, 'only "function" and "process" execution types are allowed');
		}
	}
}
