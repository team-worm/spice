import { Component, ViewChild, Directive, ElementRef, Input } from "@angular/core";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution, ExecutionId, FunctionData } from "../../models/Execution";
import { Trace } from "../../models/Trace";
import { Observable } from "rxjs/Observable";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import { MatchMaxHeightDirective } from "../../directives/MatchMaxHeight.directive";
import { Response } from "@angular/http";
import { ViewService } from "../../services/view.service";
import { FileSystemService } from "../../services/file-system.service";
import { MdSnackBar } from "@angular/material";
import { LineGraphComponent, DataXY } from "../common/line-graph.component";
import { SourceVariable, SourceVariableId } from "../../models/SourceVariable";
import { Subscriber } from "rxjs/Subscriber";
import { LoopData, TraceGroup } from "./trace-loop.component";
import { DebuggerService, ExecutionEvent, PreCallFunctionEvent, DisplayTraceEvent, ProcessEndedEvent, DetachEvent, AttachEvent } from "../../services/debugger.service";
import * as Prism from 'prismjs';


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
    public setParameters: { [id: string]: any } = {};

    @ViewChild('lineGraph') lineGraph: LineGraphComponent;
    public graphData: DataXY[] = [];
    public graphVariable: SourceVariableId | null = null;
    public currentExecution: Execution | null = null;

    constructor(private debuggerService: DebuggerService,
        private fileSystemService: FileSystemService,
        private viewService: ViewService,
        private snackBar: MdSnackBar) {
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

    public DisplayTrace(execution: Execution) {
        if (execution.data.eType !== 'function') {
            throw new Error('Cannot display trace for execution ${execution.id}: Only function traces can be displayed');
        }
        this.currentExecution = execution;
        this.debuggerService.currentDebuggerState!.ensureSourceFunctions([execution.data.sFunction])
            .mergeMap((sfMap: Map<SourceFunctionId, SourceFunction>) => {
                let sf = this.debuggerService.currentDebuggerState!.sourceFunctions.get((this.currentExecution!.data as FunctionData).sFunction) !;
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
        if (trace.data.tType === 'crash') {
            this.snackBar.open(`Program crashed: ${trace.data.stack}`, undefined, {
                duration: 5000
            });
            return;
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
        this.setSourceFunction(event.sourceFunction).subscribe(() => { }); //TODO: error handling
    }

    public ExecuteFunction() {
        if (this.sourceFunction) {
            this.debuggerService.callFunction(this.sourceFunction, this.setParameters)
                .subscribe((ex: Execution) => {
                    this.DisplayTrace(ex);
                }, (e: any) => {
                    //TODO: error handling
                    console.error(e);
                });
        }
    }

    public ActivateCall(): boolean {
        if (this.sourceFunction && this.sourceFunction.parameters) {
            for (var key in this.setParameters) {
                if (this.setParameters.hasOwnProperty(key)) {
                    return this.setParameters[key] != "";
                }
            }
            return (this.sourceFunction.parameters.length > 0 &&
                Object.keys(this.setParameters).length == this.sourceFunction.parameters.length) ||
                this.sourceFunction.parameters.length == 0;
        } else {
            return false;
        }
    }

    public GetFunctionAsString(): string {
        if (!this.sourceFunction) {
            return 'No Function Selected';
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
        if (this.sourceFunction) {
            this.graphData = [];
            this.graphVariable = variableAddress;
            this.lineGraph.onDataUpdated();
            let graphUpdates = Observable.create((observer: Subscriber<Trace>) => {
                this.debuggerService.currentDebuggerState!.ensureTrace(this.currentExecution!.id).mergeMap(tObservable => tObservable).subscribe(
                    (t: Trace) => {
                        if (t.data.tType === 'line') {
                            let stateChange = t.data.state[variableAddress];
                            if (stateChange) {
                                //TODO: use type data to graph properly
                                let value = stateChange.value;
                                if (typeof value === 'number') {
                                    this.graphData.push({ x: this.graphData.length, y: value as number });
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

    public onExecution(event: ExecutionEvent) {
        this.setParameters = {};
        if (event.reason === 'break') {
            this.DisplayTrace(event.execution!);
        }
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
    }
}
