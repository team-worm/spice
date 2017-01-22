import { DebugId } from "./DebugId";
import { Execution } from "./execution/Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction } from "./SourceFunction";
import { SourceVariable } from "./SourceVariable";
import { SpiceValidator } from "../util/SpiceValidator";

export class DebuggerState {

	public executions: { [id:string]: Execution};
	public breakpoints: { [id:string]: Breakpoint};
	public sourceFunctions: { [id:string]: SourceFunction};
	public SourceVariables: { [id:string]: SourceVariable};

	public constructor(public id: DebugId) {
	}

	public static fromObjectStrict(obj: any): DebuggerState {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'string');

		return new DebuggerState(obj.id);
	}

}
