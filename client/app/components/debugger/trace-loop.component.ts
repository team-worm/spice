import { Component, Input } from "@angular/core";
import { Trace } from "../../models/Trace";
import { DebuggerState } from "../../models/DebuggerState";
import { SourceFunction } from "../../models/SourceFunction";
import {SourceType} from "../../models/SourceType";
import {Value} from "../../models/Value";

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

/** Trace Loop Component
 * Takes in a loopData model and renders it as a table of traces. Rows
 * correspond to source code lines and columns correspond to loop iterations.
 * Recursively renders nested loops.
 */

@Component({
    moduleId: module.id,
	selector: 'spice-trace-loop',
	templateUrl: './trace-loop.component.html'
})
export class TraceLoopComponent {
	public showAllIterations: boolean = false; //only show the last iteration if false
	//treat this group as a standalone "iteration"
	@Input() public debuggerState: DebuggerState;
	@Input() public sourceFunction: SourceFunction;
	@Input() public loopData: LoopData;
	@Input() public oddStartLine: boolean = true; //set by the parent component and propegated down nesting as needed
	@Input() pointerTypes: {[address:number]:{type: SourceType, name:string}} = {};
	@Input() pointerValues: { [sVariable: number]: Value} = {};

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
}
