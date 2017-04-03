import { Component, Input } from "@angular/core";
import { Trace, LineData } from "../../models/Trace";
import { DebuggerState } from "../../models/DebuggerState";
import { SourceVariable } from "../../models/SourceVariable";
import { Value } from "../../models/Value";
import { SourceFunction } from "../../models/SourceFunction";

@Component({
    moduleId: module.id,
	selector: 'spice-trace',
	templateUrl: './trace.component.html'
})

export class TraceComponent {
	@Input() trace: Trace;
	@Input() debuggerState: DebuggerState;
	@Input() sourceFunction: SourceFunction;
	constructor() {
	}

	public getStateEntries(trace: Trace): { address: number, variable: SourceVariable | undefined, value: Value}[] {
		return Object.keys((trace.data as LineData).state).map(id => {
			return {
				address: parseInt(id),
				variable: this.sourceFunction.locals.concat(this.sourceFunction.parameters).find(v => v.address === parseInt(id)),
				value: (trace.data as LineData).state[id].value
			};
		});
	}
}
