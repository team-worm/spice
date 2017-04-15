import {Component, Input, OnChanges, OnInit} from "@angular/core";
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

export class TraceComponent implements OnChanges {
	@Input() trace: Trace;
	@Input() debuggerState: DebuggerState;
	@Input() sourceFunction: SourceFunction;

	public functionReturnType: SourceType;

	public stateEntries:{ address: number, variable: SourceVariable | undefined, value: Value, sType: SourceType | undefined}[];


	public expandMap:{[id:number]:boolean} = {};

	public viewStruct(state: { address: number, variable: SourceVariable | undefined, value: Value}) {
		this.expandMap[state.address] = !this.expandMap[state.address];
	}

	constructor() {
	}

	public getStateEntries(trace: Trace): { address: number, variable: SourceVariable | undefined, value: Value, sType: SourceType | undefined}[] {
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
				value: (trace.data as LineData).state[id],

			};
		});
	}

	public stringifyStateValue(state: { address: number, variable: SourceVariable | undefined, value: Value, sType: SourceType | undefined}):any {
		if(state.sType) {
			switch(state.sType.data.tType) {
				case "primitive":
					return state.value.value;
				case "pointer":
					return `*(${state.value.value})`;//TODO?
				case "array":
					return JSON.stringify(state.value.value);
				case "struct":
					return JSON.stringify(state.value.value);
				case "function":
					return state.sType.toString(this.debuggerState.sourceTypes);
			}
			return 'b';
		}
		return 'a';
	}

	public ngOnChanges() {
		if(this.trace && this.trace.data.tType === 'line') {
			this.stateEntries = this.getStateEntries(this.trace);
		}
		if(this.sourceFunction && this.debuggerState && this.trace && this.trace.data.tType === 'return') {
			console.log('tracedata', this.trace.data);
			this.functionReturnType = this.debuggerState.sourceTypes.get(this.sourceFunction.sType)!;
		}
	}
}
