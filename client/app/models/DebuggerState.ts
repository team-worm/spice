import { DebugId } from "./DebugId";
import { Execution } from "./execution/Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction } from "./SourceFunction";
import { SourceVariable } from "./SourceVariable";
import { SpiceValidator } from "../util/SpiceValidator";
import { Observable } from "rxjs/Observable";

export class DebuggerState {

	public executions: { [id:string]: Execution};
	public breakpoints: { [id:string]: Breakpoint};
	public sourceFunctions: { [id:string]: SourceFunction};
	public sourceVariables: { [id:string]: SourceVariable};

	constructor(public id: DebugId) {
		this.executions = {};
		this.breakpoints = {};
		this.sourceFunctions = {};
		this.sourceVariables = {};
	}

	public initialize(): Observable<null> {
		//initialize functions
		
		//mock stuff--initialize source variables
		this.sourceVariables['0'] = new SourceVariable('0', 'a', 'int', 0);
		this.sourceVariables['1'] = new SourceVariable('1', 'b', 'int', 4);
		this.sourceVariables['2'] = new SourceVariable('2', 'tmp', 'int', 8);
		this.sourceFunctions['0'] = new SourceFunction(0, 'add', 'add.cpp', 0, 5,
			[this.sourceVariables['0'], this.sourceVariables['1']],
			[this.sourceVariables['1']])
		return Observable.of(null);
	}

	public static fromObjectStrict(obj: any): DebuggerState {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'string');

		return new DebuggerState(obj.id);
	}

}
