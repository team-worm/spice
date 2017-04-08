import { Component, Input } from "@angular/core";
import { Trace, LineData } from "../../models/Trace";
import { DebuggerState } from "../../models/DebuggerState";
import { SourceVariable } from "../../models/SourceVariable";
import { Value } from "../../models/Value";
import { SourceFunction } from "../../models/SourceFunction";
import { SourceType } from "../../models/SourceType";

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
			let variable = this.sourceFunction.locals.concat(this.sourceFunction.parameters).find(v => v.address === parseInt(id));
			let sType: SourceType | undefined;
			if(variable) {
				sType = this.debuggerState.sourceTypes.get(variable.sType);
			}
			return {
				address: parseInt(id),
				variable: variable,
				sType: sType,
				value: (trace.data as LineData).state[id].value
			};
		});
	}
}
