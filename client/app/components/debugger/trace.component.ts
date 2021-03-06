import {Component, Input, OnChanges, OnInit} from "@angular/core";
import { Trace, LineData } from "../../models/Trace";
import { DebuggerState } from "../../models/DebuggerState";
import { SourceVariable } from "../../models/SourceVariable";
import { Value } from "../../models/Value";
import { SourceFunction } from "../../models/SourceFunction";
import { SourceType } from "../../models/SourceType";

/** Trace Component
 * Renders a single trace iteration
 */
@Component({
    moduleId: module.id,
	selector: 'spice-trace',
	templateUrl: './trace.component.html'
})

export class TraceComponent implements OnChanges {
	@Input() trace: Trace;
	@Input() debuggerState: DebuggerState;
	@Input() sourceFunction: SourceFunction;
	@Input() pointerTypes: {[address:number]:{type: SourceType, name:string}} = {};
	@Input() pointerValues: { [sVariable: number]: Value} = {};

	public functionReturnType: SourceType;

	public stateEntries:{ address: number, name:string, value: Value, sType: SourceType | undefined, valueMap:{[sVariable: number]: Value}}[];


	public expandMap:{[id:number]:boolean} = {};

	public viewStruct(state: { address: number, variable: SourceVariable | undefined, value: Value}) {
		this.expandMap[state.address] = !this.expandMap[state.address];
	}

	constructor() {
	}

	public getStateEntries(trace: Trace): { address: number, name: string, value: Value, sType: SourceType | undefined, valueMap:{[sVariable: number]: Value}}[] {

		/* Build mapping of pointer values up until this point. */
		let traceState = (trace.data as LineData).state;
		let vm:{[sVariable: number]: Value} = {};

		for(let k of Object.keys(traceState)) {
			vm[k] = traceState[k];
		}

		for(let v of Object.keys(this.pointerValues)) {
			if(!vm[v]) {
				vm[v] = {... this.pointerValues[v]}; //Deep copy
			}
		}
		/* Build individual trace entries */
		return Object.keys(traceState).map(id => {
			let variable = this.sourceFunction.locals.concat(this.sourceFunction.parameters).find(v => v.address === parseInt(id));
			let sType: SourceType | undefined = undefined;
			let name = '__';
			if(variable) {
				sType = this.debuggerState.sourceTypes.get(variable.sType);
				name = variable.name
			} else if(this.pointerTypes[parseInt(id)]) {
				let info = this.pointerTypes[parseInt(id)];
				name = info.name;
				sType = info.type;
			}
			return {
				address: parseInt(id),
				name: name,
				sType: sType,
				value: traceState[id],
				valueMap: vm,

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
			this.functionReturnType = this.debuggerState.sourceTypes.get(this.sourceFunction.sType)!;
		}
	}
}
