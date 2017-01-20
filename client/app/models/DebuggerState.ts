import { DebugId } from "./DebugId";
import { Execution } from "./execution/Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction } from "./SourceFunction";
import { SourceVariable } from "./SourceVariable";

export class DebuggerState {

	public executions: { [id:string]: Execution};
	public breakpoints: { [id:string]: Breakpoint};
	public sourceFunctions: { [id:string]: SourceFunction};
	public SourceVariables: { [id:string]: SourceVariable};

	public constructor(public id: DebugId) {
	}

}
