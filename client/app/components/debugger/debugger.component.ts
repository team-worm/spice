import {Component, QueryList, ViewChild, ViewChildren} from "@angular/core";
import { Execution, ExecutionId, FunctionData } from "../../models/Execution";
import { Trace, LineData } from "../../models/Trace";
import { Observable } from "rxjs/Observable";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import { Response } from "@angular/http";
import { ViewService } from "../../services/view.service";
import { FileSystemService } from "../../services/file-system.service";
import { MdSnackBar } from "@angular/material";
import { LineGraphComponent, DataXY } from "../common/line-graph.component";
import { SourceVariableId } from "../../models/SourceVariable";
import { Subscriber } from "rxjs/Subscriber";
import { LoopData, TraceGroup } from "./trace-loop.component";
import { DebuggerService, ExecutionEvent, PreCallFunctionEvent, DisplayTraceEvent, AttachEvent } from "../../services/debugger.service";
import {VariableDisplayComponent} from "../common/variable-display/variable-display.component";
import * as Prism from 'prismjs';
import { GraphDisplayComponent, GraphData, DataNode, DataEdge } from "../common/graph-display.component";
import { SourceType } from "../../models/SourceType";
import { StructValue, Value, PointerValue } from "../../models/Value";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";

@Component({
    moduleId: module.id,
	selector: 'spice-debugger',
	templateUrl: './debugger.component.html'
})
export class DebuggerComponent {

	public lines: string[] = [];
    public traceData: LoopData = { kind: 'loop', startLine: 0, endLine: 0, iterations: [] };
	public lastTrace: Trace | null = null;
	public traceLoopStack: LoopData[] = [];

	public sourceFunction: SourceFunction | null = null;

	@ViewChildren('varDisplay')
	private variableDisplays:QueryList<VariableDisplayComponent>;

	public setParameters:{[address: number]: Value} = {};

	@ViewChild('lineGraph') lineGraph: LineGraphComponent;
	@ViewChild('graphDisplay') graphDisplay: GraphDisplayComponent;
	public graphData: DataXY[] = [];
	public graphVariable: SourceVariableId | null = null;

	public nodeGraphData: GraphData = {nodes: [], edges: []};
	public nodeGraphVariable: SourceVariableId | null = null;
	public nodeGraphFieldOffsets: Set<number>;
	public nodeGraphDataOffset: number | null = null;
	public nodeGraphTrackedNode: SourceVariableId | null = null;

	public currentExecution: Execution | null = null;
	public currentSession: number;

	public pointerTypes:{[address:number]:{type: SourceType, name:string}} = {};
	public pointerValues: { [sVariable: number]: Value} = {};

	constructor(public debuggerService: DebuggerService,
				private fileSystemService: FileSystemService,
				private viewService: ViewService,
				private snackBar: MdSnackBar) {

		this.nodeGraphFieldOffsets = new Set<number>();
		this.viewService.debuggerComponent = this;
		this.debuggerService.getEventStream(['execution']).subscribe((event: ExecutionEvent) => this.onExecution(event));
		this.debuggerService.getEventStream(['preCallFunction']).subscribe((event: PreCallFunctionEvent) => this.onPreCallFunction(event));
		this.debuggerService.getEventStream(['displayTrace']).subscribe((event: DisplayTraceEvent) => this.onDisplayTrace(event));
		this.debuggerService.getEventStream(['attach']).subscribe((event: AttachEvent) => this.resetView());
	}

	public setSourceFunction(sf: SourceFunction): Observable<null> {
		this.sourceFunction = sf;
		this.lines = [];
		return this.fileSystemService.getFileContents(sf.sourcePath)
			.map(fileContents => {
				this.lines = fileContents.split('\n')
                    .filter((l, i) => this.sourceFunction && i >= (this.sourceFunction.lineStart - 1) && i < (this.sourceFunction.lineStart - 1 + this.sourceFunction.lineCount));
                this.lines = this.lines.map(function(l) {
                    return Prism.highlight(l, Prism.languages["clike"]);
                });
				this.traceData = {
					kind: 'loop',
					startLine: sf.lineStart,
					endLine: sf.lineStart + sf.lineCount,
					iterations: [[]]
				};
				this.lastTrace = null;
				this.traceLoopStack = [this.traceData];
				this.lines.forEach((_, i) => {
                    MatchMaxHeightDirective.markDirty(`debugger-${sf.lineStart + i}`);
				});
				return null;
			});
	}

	public DisplayTrace(execution: Execution, sessId?: number) {
		if(execution.data.eType !== 'function') {
			throw new Error('Cannot display trace for execution ${execution.id}: Only function traces can be displayed');
		}
		this.currentExecution = execution;
		if (!sessId) {
			this.currentSession = this.debuggerService.currentDebuggerState!.info.id;
		} else {
			this.currentSession = sessId;
		}
		this.debuggerService.currentDebuggerState!.ensureSourceFunctions([execution.data.sFunction])
			.mergeMap((sfMap: Map<SourceFunctionId, SourceFunction>) => {
				let sf = this.debuggerService.currentDebuggerState!.sourceFunctions.get((this.currentExecution!.data as FunctionData).sFunction)!;
				return Observable.forkJoin(
					this.setSourceFunction(sf),
					this.debuggerService.currentDebuggerState!.ensureTrace(execution.id));
			}).mergeMap(([fileContents, trace]: [null, Observable<Trace>]) => {
				return trace;
			}).subscribe(
				(t: Trace) => { this.addTrace(t); },
				(error: any) => { console.error(error); }
		);
	}

	public addTrace(trace: Trace) {
        if (trace.data.tType === 'call') {
			//TODO: properly handle these
			return;
		}

        if (['return', 'cancel'].indexOf(trace.data.tType) > -1) {
            let reason: any = trace.data.tType;
            this.debuggerService.executionStopped(reason);
        }

		if(['exit', 'crash', 'error'].indexOf(trace.data.tType) > -1) {
			if(trace.data.tType === 'crash') {
				this.debuggerService.errorOccurred('crash', trace.data.stack);
			}
			else if(trace.data.tType === 'error') {
				this.debuggerService.errorOccurred('error', trace.data.error);
			}

			this.debuggerService.processEnded(trace.data.tType as 'exit' | 'crash' | 'error');
		}

		if (trace.data.tType === 'line' && this.sourceFunction && this.debuggerService.currentDebuggerState) {
        	let ds = this.debuggerService.currentDebuggerState;
        	for(let id of Object.keys(trace.data.state)) {
        		let variable = this.sourceFunction.locals.concat(this.sourceFunction.parameters).find(v => v.address === parseInt(id));
        		let value:Value = trace.data.state[id];
        		if(variable && value.value) {
					let pt = ds.sourceTypes.get(variable.sType)!;
					let v = parseInt(value.value.toString());
					if(pt.data.tType === 'pointer') {
						let dt = ds.sourceTypes.get(pt.data.sType)!;
						this.pointerTypes[v] = {type: dt, name: variable.name + '*'};

					}

				} else {
					this.pointerValues[id] = value;
				}


			}
		}


		//This naive implementation doesn't properly handle "early exit" of loops (break, continue)/assumes loops have some kind of "loop closing" trace
		//In order to handle early exists, we need to go back and reorganize previous loops
		//this probably involves changing loop.endLine values and moving traces into a more deeply nested loop
		let currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
        if (this.lastTrace !== null) {
            if (trace.line > this.lastTrace.line) {
                if (trace.line > currentLoop.endLine) {
					this.traceLoopStack.pop();
					currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
				}
			}
			else {

                while (true) {
                    if (currentLoop.startLine > trace.line) {
						this.traceLoopStack.pop();
						currentLoop = this.traceLoopStack[this.traceLoopStack.length - 1];
					}
                    else if (currentLoop.startLine === trace.line) {
						currentLoop.iterations.push([]);
						break;
					}
					else {
                        let iteration = currentLoop.iterations[currentLoop.iterations.length - 1];
						let tgLine = -1;
                        let traceGroupIndex = iteration.findIndex((tg: TraceGroup) => {
							tgLine = (tg.kind === 'trace' && tg.trace.line) ||
										 (tg.kind === 'loop' && tg.startLine) || -1;
							return tgLine >= trace.line;
						});

						//if tgLine === -1 we're in trouble
                        let newLoop: TraceGroup = { kind: 'loop', startLine: tgLine, endLine: this.lastTrace.line, iterations: [iteration.slice(traceGroupIndex), []] };
                        currentLoop.iterations[currentLoop.iterations.length - 1] = iteration.slice(0, traceGroupIndex);
                        currentLoop.iterations[currentLoop.iterations.length - 1].push(newLoop);
						this.traceLoopStack.push(newLoop);
						currentLoop = newLoop;
						break;
					}
				}
			}
		}

        currentLoop.iterations[currentLoop.iterations.length - 1].push({ kind: 'trace', trace: trace });
		this.lastTrace = trace;
	}

	public onPreCallFunction(event: PreCallFunctionEvent) {
		this.setParameters = {};
		if(this.debuggerService.currentDebuggerState) {
			for(let par of event.sourceFunction.parameters) {
				this.setParameters[par.address] = this.debuggerService.currentDebuggerState.sourceTypes.get(par.sType)!.getDefaultValue();
			}
		}
		this.setSourceFunction(event.sourceFunction).subscribe(() => {}); //TODO: error handling
	}

	public CallFunction() {
		if(this.sourceFunction) {
			for(let i = 0; i < this.variableDisplays.length; i++) {
				let vdc:VariableDisplayComponent = this.variableDisplays.toArray()[i];
				let val = vdc.applyValue(this.setParameters);
			}
			this.debuggerService.callFunction(this.sourceFunction, this.setParameters)
				.subscribe((ex:Execution)=>{
					this.DisplayTrace(ex);
				}, (e:any) => {
					//TODO: error handling
					console.error(e);
				});
		}
	}

    public GetFunctionAsString(): string {
		if (!this.sourceFunction) {
			return 'No Function Selected';
		} else if (this.debuggerService.debuggerStates.get(this.currentSession)) {
			let stMap = this.debuggerService.debuggerStates.get(this.currentSession) !.sourceTypes;
			const parameters = this.sourceFunction.parameters
                .map(parameter => stMap.get(parameter.sType)
				&& `${stMap.get(parameter.sType) !.toString(stMap)} ${parameter.name}`)
                .join(", ");
			return `${this.sourceFunction.name}(${parameters})`;
		} else if (this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.sourceTypes) {
			let stMap = this.debuggerService.currentDebuggerState.sourceTypes;
			const parameters = this.sourceFunction.parameters
                .map(parameter => `${stMap.get(parameter.sType) !.toString(stMap)} ${parameter.name}`)
                .join(", ");
			return `${this.sourceFunction.name}(${parameters})`;
		} else {
			return 'Error: SourceTypes Not Valid';
		}
	}

	public GoToFunctionsView() {
		this.debuggerService.displayFunction(null);
	}

	public SetGraphVariable(variableAddress: SourceVariableId): void {
		//TODO: check if variable is graphable
		if(this.sourceFunction) {
			this.graphData = [];
			this.graphVariable = variableAddress;
			this.lineGraph.onDataUpdated();
			let graphUpdates = Observable.create((observer: Subscriber<Trace>) => {
				this.debuggerService.currentDebuggerState!.ensureTrace(this.currentExecution!.id).mergeMap(tObservable => tObservable).subscribe(
					(t: Trace) => {
						if(t.data.tType === 'line') {
							let stateChange = t.data.state[variableAddress];
							if(stateChange) {
								//TODO: use type data to graph properly
								let value = stateChange.value;
								if(typeof value === 'number') {
									this.graphData.push({x: this.graphData.length, y: value as number});
								}
								observer.next();
							}
						}
					},
                        (error: Response) => {
						console.error(error);
					});
			}).debounceTime(100).subscribe(
				() => this.lineGraph.onDataUpdated());
		}
	}

	public variableBaseTypeIsStruct(id: SourceVariableId | null): boolean {
		let sourceType = this.getVariableBaseType(id);
		return !!sourceType && sourceType.data.tType === 'struct';
	}

	public getVariableType(id: SourceVariableId | null): SourceType | null {
		if(!id || ! this.debuggerService.currentDebuggerState || !this.sourceFunction) {
			return null;
		}
		let sourceVariable = this.sourceFunction.locals.concat(this.sourceFunction.parameters).find(v => v.address === id);
		return sourceVariable && this.debuggerService.currentDebuggerState.sourceTypes.get(sourceVariable.sType) || null;
	}

	public getVariableBaseType(id: SourceVariableId | null): SourceType | null {
		let initialType = this.getVariableType(id);
		if(!initialType) {
			return null;
		}
		return this.getBaseType(initialType);
	}

	public getBaseType(sourceType: SourceType): SourceType {
		switch(sourceType.data.tType) {
			case 'primitive':
			case 'function':
			case 'struct':
			return sourceType;
			case 'pointer':
			case 'array':
				return this.getBaseType(this.debuggerService.currentDebuggerState!.sourceTypes.get(sourceType.data.sType)!);
		}
	}

	public toggleNodeGraphFieldIndex(i: number) {
		if(this.nodeGraphFieldOffsets.has(i)) {
			this.nodeGraphFieldOffsets.delete(i);
		}
		else {
			this.nodeGraphFieldOffsets.add(i);
		}
	}

	public SetNodeGraphVariable(variableId: SourceVariableId): void {
		if(this.sourceFunction) {
			this.nodeGraphData = {nodes: [], edges: []};
			this.nodeGraphVariable = variableId;
			let trackedNodeCount = 0;
			this.graphDisplay.onDataUpdated(trackedNodeCount);

			let graphUpdates = Observable.create((observer: Subscriber<Trace>) => {
				this.debuggerService.currentDebuggerState!.ensureTrace(this.currentExecution!.id).mergeMap(tObservable => tObservable).subscribe(
					(t: Trace) => {
						if(t.data.tType === 'line') {
							let lineData: LineData = t.data;
							let rootStructAddress: PointerValue | null = null;
							if(lineData.state[this.nodeGraphVariable!]) {
								rootStructAddress = lineData.state[this.nodeGraphVariable!].value as PointerValue;
								if(Array.isArray(rootStructAddress)) {
									rootStructAddress = rootStructAddress[0].value as PointerValue;
								}
							}
							let processedNodes = new Set<number>();
							//for all nodes in the graph changed in this trace (and the root), remove old edges and nodes, add new edges and nodes
							let updatedNodes = Object.keys(t.data.state)
								.filter(s => parseInt(s) === rootStructAddress || !!this.nodeGraphData.nodes.find(n => n.id === parseInt(s)));

							function updateNode(nodeStructAddress: number) {
								if(!lineData.state[nodeStructAddress]) {
									//the pointer is probably garbage from initialization, just skip it
									return;
								}
								if(processedNodes.has(nodeStructAddress)) {
									return;
								}

								processedNodes.add(nodeStructAddress);
								//assume a node is always a pointer to a struct
								//TODO: make this generalized (using spice types)

								let nodeIdx = this.nodeGraphData.nodes.findIndex((n:DataNode) => n.id === nodeStructAddress);
								let nodeData = null;
								if(this.nodeGraphDataOffset !== null) {
									let structVal = (lineData.state[nodeStructAddress].value as StructValue);
									if(Array.isArray(structVal)) {
										structVal = structVal[0].value;
									}
									nodeData = ''+structVal[this.nodeGraphDataOffset].value;
								}
								let nodeObj: DataNode;
								if(nodeIdx === -1) {
									//if this node doesn't exist in the graph, add it
									nodeObj = {id: nodeStructAddress, data: nodeData, trackedNodeValue: null, edgesOut: {}};
									this.nodeGraphData.nodes.push(nodeObj);

								} else {
									nodeObj = this.nodeGraphData.nodes[nodeIdx]
									nodeObj.data = nodeData;
								}

								let nodeStructValue = lineData.state[nodeStructAddress].value as StructValue;
								if(Array.isArray(nodeStructValue)) {
									nodeStructValue = nodeStructValue[0].value;
								}
								Array.from(this.nodeGraphFieldOffsets.values()).forEach((offset: number) => {
									let nodeEdgePointer = nodeStructValue[offset].value as PointerValue;
									let edgeId = `${nodeStructAddress},${nodeEdgePointer}`;

									if(nodeObj.edgesOut[offset] && nodeObj.edgesOut[offset].target.id !== nodeEdgePointer) {
										//remove the old edge, mark node for deletion
										//TODO:
									}
									//if there is no state for this edge, it's probably a garbage pointer so we wouldn't process it
									if(nodeEdgePointer && lineData.state[nodeEdgePointer]) {
										//update/create children
										updateNode.call(this, nodeEdgePointer);

										//update edges
										let edgeIdx = this.nodeGraphData.edges.findIndex((n:DataEdge) => n.id === edgeId);
										let edgeObj: DataEdge;
										if(edgeIdx === -1) {
											//add
											edgeObj = {id: edgeId, source: nodeStructAddress as any, target: nodeEdgePointer as any};
											this.nodeGraphData.edges.push(edgeObj);
											nodeObj.edgesOut[offset] = edgeObj;
										} else {
											// update
											//edgeObj = this.nodeGraphData.edges[edgeIdx];
										}
									}
								});
							}

							updatedNodes.forEach(address => updateNode.call(this, parseInt(address)));

							if(this.nodeGraphTrackedNode && lineData.state[this.nodeGraphTrackedNode]) {
								let nodeObj = this.nodeGraphData.nodes.find((n:DataNode) => n.id === lineData.state[this.nodeGraphTrackedNode!].value);
								if(nodeObj) {
									nodeObj.trackedNodeValue = trackedNodeCount;
									trackedNodeCount++;
								}
							}

							observer.next();
						}
					},
                        (error: Response) => {
						console.error(error);
					});
			}).debounceTime(100).subscribe(
				() => this.graphDisplay.onDataUpdated(trackedNodeCount));
		}
	}

	public onExecution(event: ExecutionEvent) {
		this.setParameters = {};
		if(this.debuggerService.currentDebuggerState && this.sourceFunction) {
			for(let par of this.sourceFunction.parameters) {
				this.setParameters[par.address] = this.debuggerService.currentDebuggerState.sourceTypes.get(par.sType)!.getDefaultValue();
			}
		}
		if(event.reason === 'break') {
			this.DisplayTrace(event.execution!);
		}
	}

	public onCustomParameterChange(event: { address:number, val:Value}) {
		this.setParameters[event.address] = event.val;
	}

	protected onDisplayTrace(event: DisplayTraceEvent) {
		this.DisplayTrace(event.execution);
	}

	protected resetView() {
		this.lines = [];
		this.traceData = { kind: 'loop', startLine: 0, endLine: 0, iterations: [] };
		this.lastTrace = null;
		this.traceLoopStack = [];

		this.sourceFunction = null;
		this.setParameters = {};


		this.graphData = [];
		this.graphVariable = null;
		this.currentExecution = null;
		this.nodeGraphData = {nodes: [], edges: []};
		this.nodeGraphVariable = null;
		this.nodeGraphFieldOffsets = new Set<number>();
		this.nodeGraphDataOffset = null;
		this.nodeGraphTrackedNode = null;
	}

	public sortSourceFunctions(arr: SourceFunction[]) {
		return arr.sort((a,b)=> a.name.localeCompare(b.name));
	}
}
