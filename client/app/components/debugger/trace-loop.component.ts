import { Component, Input } from "@angular/core";
import { Trace } from "../../models/Trace";
import { DebuggerState } from "../../models/DebuggerState";
import { SourceFunction } from "../../models/SourceFunction";


export interface TraceData {
	kind: 'trace';
	trace: Trace;
}

export interface LoopData {
	kind: 'loop';
	startLine: number;
	endLine: number;
	iterations: IterationData[];
}

export type TraceGroup = TraceData | LoopData;

export type IterationData = TraceGroup[];

@Component({
    moduleId: module.id,
	selector: 'spice-trace-loop',
	templateUrl: './trace-loop.component.html'
})
export class TraceLoopComponent {
	//@Input() trace: Trace;
	//public iterationCount: number = 0;
	//public : number = 0;
	public showAllIterations: boolean = false; //only show the last iteration if false
	//treat this group as a standalone "iteration"
	@Input() public debuggerState: DebuggerState;
	@Input() public sourceFunction: SourceFunction;
	@Input() public loopData: LoopData;
	@Input() public oddStartLine: boolean = true; //set by the parent component and propegated down nesting as needed
	constructor() {
	}

	public toggleShowAllIterations(): void {
		this.showAllIterations = !this.showAllIterations;
	}

	public getTraceGroupAtLine(iteration: IterationData, lineNum: number): TraceGroup | null {
		for(let i = 0; i < iteration.length; i++) {
			let traceGroup = iteration[i];
			switch(traceGroup.kind) {
				case 'trace':
					if(traceGroup.trace.line === lineNum) {
						return traceGroup;
					}
					break;
				case 'loop':
					if(lineNum >= traceGroup.startLine && lineNum <= traceGroup.endLine) {
						return traceGroup;
					}
					break;
			}
		}
		return null;
	}

	/* example loopData for nested loop
			this.loopData = {
				kind: 'loop',
				startLine: 3,
				endLine: 14,
				iterations: [[
					{ kind: 'trace', trace: {"index":0,"line":0,"data":{"tType":"call","sFunction":140700646840048}}},
					{ kind: 'trace', trace: {"index":1,"line":3,"data":{"tType":"line","state":[{"sVariable":"a","value":"3"},{"sVariable":"b","value":"2"}]}}},
					{ kind: 'trace', trace: {"index":2,"line":4,"data":{"tType":"line","state":[{"sVariable":"s","value":"0"}]}}},
					{ kind: 'trace', trace: {"index":3,"line":5,"data":{"tType":"line","state":[{"sVariable":"t","value":"0"}]}}},
					{ kind: 'trace', trace: {"index":4,"line":6,"data":{"tType":"line","state":[{"sVariable":"i","value":"0"}]}}},
					{ kind: 'loop', startLine: 7, endLine: 12, iterations: [
						[
							{ kind: 'trace', trace: {"index":5,"line":7,"data":{"tType":"line","state":[{"sVariable":"j","value":"0"}]}}},
							{ kind: 'loop', startLine: 9, endLine: 10, iterations: [
								[
									{ kind: 'trace', trace: {"index":6,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"1"}]}}},
									{ kind: 'trace', trace: {"index":7,"line":10,"data":{"tType":"line","state":[{"sVariable":"j","value":"1"}]}}},
								],
								[
									{ kind: 'trace', trace: {"index":8,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"2"}]}}},
									{ kind: 'trace', trace: {"index":9,"line":10,"data":{"tType":"line","state":[]}}},
								]]},
							{ kind: 'trace', trace: {"index":10,"line":11,"data":{"tType":"line","state":[{"sVariable":"s","value":"1"}]}}},
							{ kind: 'trace', trace: {"index":11,"line":12,"data":{"tType":"line","state":[{"sVariable":"j","value":"2"},{"sVariable":"i","value":"1"}]}}},
						],
						[
							{ kind: 'trace', trace: {"index":12,"line":7,"data":{"tType":"line","state":[{"sVariable":"j","value":"0"}]}}},
							{ kind: 'loop', startLine: 9, endLine: 10, iterations: [
								[
									{ kind: 'trace', trace: {"index":13,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"3"}]}}},
									{ kind: 'trace', trace: {"index":14,"line":10,"data":{"tType":"line","state":[{"sVariable":"j","value":"1"}]}}},
								],
								[
									{ kind: 'trace', trace: {"index":15,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"4"}]}}},
									{ kind: 'trace', trace: {"index":16,"line":10,"data":{"tType":"line","state":[]}}},
								]]},
							{ kind: 'trace', trace: {"index":17,"line":11,"data":{"tType":"line","state":[{"sVariable":"s","value":"2"}]}}},
							{ kind: 'trace', trace: {"index":18,"line":12,"data":{"tType":"line","state":[{"sVariable":"j","value":"2"},{"sVariable":"i","value":"2"}]}}},
						],
						[
							{ kind: 'trace', trace: {"index":19,"line":7,"data":{"tType":"line","state":[{"sVariable":"j","value":"0"}]}}},
							{ kind: 'loop', startLine: 9, endLine: 10, iterations: [
								[
									{ kind: 'trace', trace: {"index":20,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"5"}]}}},
									{ kind: 'trace', trace: {"index":21,"line":10,"data":{"tType":"line","state":[{"sVariable":"j","value":"1"}]}}},
								],
								[
									{ kind: 'trace', trace: {"index":22,"line":9,"data":{"tType":"line","state":[{"sVariable":"t","value":"6"}]}}},
									{ kind: 'trace', trace: {"index":23,"line":10,"data":{"tType":"line","state":[]}}},
								]]},
							{ kind: 'trace', trace: {"index":24,"line":11,"data":{"tType":"line","state":[{"sVariable":"s","value":"3"}]}}},
							{ kind: 'trace', trace: {"index":25,"line":12,"data":{"tType":"line","state":[]}}},
						]]},
					{ kind: 'trace', trace: {"index":26,"line":14,"data":{"tType":"return","value":"6"}}},
					]]
				};
	 */
}
