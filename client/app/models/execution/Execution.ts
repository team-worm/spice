import { ExecutionId } from "./ExecutionId";
import { InvalidValueError } from "../errors/Errors";
import { SpiceValidator } from "../../util/SpiceValidator";

export type ExecutionType = 'function' | 'process';
export type ExecutionStatus = 'pending' | 'executing' | 'stopped' | 'done';

export class Execution {
	protected constructor(
		public id: ExecutionId, //Unique identifier.
		public eType: ExecutionType,
		public status: ExecutionStatus,
		public executionTime: number, //Execution time in nanoseconds.
		public data: any
	){
	}

	public static assertExecutionStatus(status: string): void {
		if(['pending', 'executing', 'stopped', 'done'].indexOf(status) === -1) {
			throw new InvalidValueError(status);
		}
	}
}
