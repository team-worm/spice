import { Component, ViewChild } from "@angular/core";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution, ExecutionId } from "../../models/Execution";
import { Trace, TraceState } from "../../models/Trace";
import { Observable } from "rxjs/Observable";
import { SourceFunction } from "../../models/SourceFunction";
import { MatchMaxHeightDirective } from "../../directives/MatchMaxHeight.directive";
import { Response } from "@angular/http";
import { ViewService } from "../../services/view.service";
import { FileSystemService } from "../../services/file-system.service";
import { MdSnackBar } from "@angular/material";
import { LineGraphComponent, DataXY } from "../common/line-graph.component";
import { SourceVariable } from "../../models/SourceVariable";
import { Subscriber } from "rxjs/Subscriber";
import { LoopData, TraceGroup } from "./trace-loop.component";

@Component({
    moduleId: module.id,
	selector: 'spice-debugger',
	templateUrl: './debugger.component.html'
})
export class DebuggerComponent {

	public lines: string[] = [];
	//public lastTraceLine: number = Number.POSITIVE_INFINITY;;
	//public traceColCount: number = 0;
	public traceData: LoopData = { kind: 'loop', startLine: 0, endLine: 0, iterations: []};
	public lastTrace: Trace | null = null;
	public traceLoopStack: LoopData[] = [];

	public sourceFunction: SourceFunction | null = null;
	public debugState: DebuggerState | null = null;
	public setParameters:{[id: string]: any} = {};

	@ViewChild('lineGraph') lineGraph: LineGraphComponent;
	public graphData: DataXY[] = [];
	//public graphVariable: SourceVariable | null = null; //TODO: update this when we don't just use variable name in trace (and corresponding html)
	public graphVariable: string = "";
	public graphVariableName: string = "";
	public currentExecution: ExecutionId | null = null;

	constructor(private fileSystemService: FileSystemService,
				private viewService: ViewService,
				private snackBar: MdSnackBar) {
		this.viewService.debuggerComponent = this;
	}

	public displayTrace(executionId: ExecutionId) {
		this.currentExecution = executionId;
		if(this.debugState) {
			let ds: DebuggerState = this.debugState;
			if(this.graphVariable !== '') {
				this.SetGraphVariable(this.graphVariable);
			}
			ds.getExecution(executionId)
                .mergeMap((ex: Execution) => {
					if(ex.data.eType !== 'function') {
						return Observable.throw(new Error(`DebuggerComponent: cannot display execution traces with type ${ex.data.eType}`));
					}
					return Observable.forkJoin(
						ds.getSourceFunction(ex.data.sFunction)
                            .mergeMap((sf:SourceFunction) => {
								this.sourceFunction = sf; return this.fileSystemService.getFileContents(sf.sourcePath)}),
						Observable.of(ds.getTrace(executionId)));
				})
                .mergeMap(([fileContents, traces]) => {
					this.lines = fileContents.split('\n')
                        .filter((l,i) => this.sourceFunction && i>=(this.sourceFunction.lineStart-1) && i<(this.sourceFunction.lineStart-1 + this.sourceFunction.lineCount));
					//this.lastTraceLine = Number.POSITIVE_INFINITY;
					//this.traceColCount = 0;
					this.traceData = {
						kind: 'loop',
						startLine: this.sourceFunction!.lineStart,
						endLine: this.sourceFunction!.lineStart + this.sourceFunction!.lineCount,
						iterations: [[]]
					};
					this.lastTrace = null;
					this.traceLoopStack = [this.traceData];
					this.lines.forEach((_, i) => {
						MatchMaxHeightDirective.markDirty(`debugger-${this.sourceFunction!.lineStart+i}`);
					});
					return Observable.from(traces);
				})
                .subscribe({
					next: (t: Trace)=>{
						this.addTrace(t);
					},
					complete: ()=>{},
					error: (error:Response)=>{
						console.error(error);
					}
				});
		}
		else {
			console.error('Not attached');
		}
	}

	public addTrace(trace: Trace) {
		if(trace.data.tType === 'call') {
			//TODO: properly handle these
			return;
		}

		//This naive implementation doesn't properly handle "early exit" of loops (break, continue)/assumes loops have some kind of "loop closing" trace
		//In order to handle early exists, we need to go back and reorganize previous loops
		//this probably involves changing loop.endLine values and moving traces into a more deeply nested loop
		let currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
		if(this.lastTrace !== null) {
			if(trace.line > this.lastTrace.line) {
				if(trace.line > currentLoop.endLine) {
					this.traceLoopStack.pop();
					currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
				}
			}
			else {

				while(true) {
					if(currentLoop.startLine > trace.line) {
						this.traceLoopStack.pop();
						currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
					}
					else if(currentLoop.startLine === trace.line) {
						currentLoop.iterations.push([]);
						break;
					}
					else {
						let iteration = currentLoop.iterations[currentLoop.iterations.length-1];
						let tgLine = -1;
						let traceGroupIndex = iteration.findIndex((tg:TraceGroup) => {
							tgLine = (tg.kind === 'trace' && tg.trace.line) ||
										 (tg.kind === 'loop' && tg.startLine) || -1;
							return tgLine >= trace.line;
						});

						//if tgLine === -1 we're in trouble
						let newLoop: TraceGroup = { kind: 'loop', startLine: tgLine, endLine: this.lastTrace.line, iterations: [iteration.slice(traceGroupIndex), []]};
						currentLoop.iterations[currentLoop.iterations.length-1] = iteration.slice(0, traceGroupIndex);
						currentLoop.iterations[currentLoop.iterations.length-1].push(newLoop);
						this.traceLoopStack.push(newLoop);
						currentLoop = newLoop;
						break;
					}
				}
			}
		}

		currentLoop.iterations[currentLoop.iterations.length-1].push({ kind: 'trace', trace: trace});
		this.lastTrace = trace;
	}

	public ExecuteFunction() {
		if(this.debugState && this.sourceFunction) {
			this.debugState.executeFunction(this.sourceFunction.address,this.setParameters)
                .subscribe((ex:Execution)=>{
					this.displayTrace(ex.id);
				}, (e:any) => {
					console.error(e);
				});
		} else {
			this.snackBar.open('No breakpoint set.', undefined, {
				duration: 3000
			});
		}
	}

	public GetFunctionAsString():string {
		if(!this.sourceFunction) {
			return 'No Function Selected';
		} else {
			return this.sourceFunction.name + ' ' + this.sourceFunction.getParametersAsString();
		}
	}

	public GoToFunctionsView() {
		this.viewService.activeView = 'functions';
	}

	public SetGraphVariable(variableName: string): void {
		if(this.currentExecution !== null) {
			this.graphData = [];
			this.graphVariable = variableName;
			this.lineGraph.onDataUpdated();

			if(this.debugState && this.currentExecution !== null) {
				let graphUpdates = Observable.create((observer: Subscriber<Trace>) => {
					this.debugState!.getTrace(this.currentExecution!).subscribe(
						(t: Trace) => {
							if(t.data.tType === 'line') {
								t.data.state.filter((s:TraceState) => s.sVariable === variableName)
									.forEach((s:TraceState) => {
									this.graphData.push({x: this.graphData.length, y: parseInt(s.value)});
									observer.next();
								});
							}
						},
						(error:Response)=>{
							console.error(error);
						});
				}).debounceTime(100).subscribe(
					() => this.lineGraph.onDataUpdated());
			}
			else {
				console.error('Not attached');
			}
		}
	}
}
