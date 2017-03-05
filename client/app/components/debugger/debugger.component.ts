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

@Component({
    moduleId: module.id,
    selector: 'spice-debugger',
    templateUrl: './debugger.component.html'
})
export class DebuggerComponent {

    public lines: { sourceCode: string, traces: Trace[] }[];
    public lastTraceLine: number;
    public traceColCount: number;

    public sourceFunction: SourceFunction | null;
    public debugState: DebuggerState | null;
    public setParameters: { [id: string]: any };

    @ViewChild('lineGraph') lineGraph: LineGraphComponent;
    public graphData: DataXY[] = [];
    //public graphVariable: SourceVariable | null = null; //TODO: update this when we don't just use variable name in trace (and corresponding html)
    public graphVariable: string = "";
    public graphVariableName: string = "";
    public variables: Set<string>;
    public showGraph: boolean;

    public currentExecution: ExecutionId | null = null;

    constructor(private fileSystemService: FileSystemService,
        private viewService: ViewService,
        private snackBar: MdSnackBar) {

        this.viewService.debuggerComponent = this;
        this.lastTraceLine = Number.POSITIVE_INFINITY;
        this.traceColCount = 0;
        this.lines = [];
        this.sourceFunction = null;
        this.setParameters = {};
        this.variables = new Set();
        this.showGraph = false;
    }

    public displayTrace(executionId: ExecutionId) {
        this.currentExecution = executionId;
        if (this.debugState) {
            let ds: DebuggerState = this.debugState;
            //            this.variables = Array.from(ds.sourceVariables.keys());
            this.debugState!.getTrace(this.currentExecution!).subscribe(
                (t: Trace) => {
                    if (t.data.tType === 'line') {
                        t.data.state.forEach((s: TraceState) => this.variables.add(s.sVariable));
                    }
                });

            if (this.graphVariable !== '') {
                this.SetGraphVariable(this.graphVariable);
            }
            ds.getExecution(executionId)
                .mergeMap((ex: Execution) => {
                    if (ex.data.eType !== 'function') {
                        return Observable.throw(new Error(`DebuggerComponent: cannot display execution traces with type ${ex.data.eType}`));
                    }
                    return Observable.forkJoin(
                        ds.getSourceFunction(ex.data.sFunction)
                            .mergeMap((sf: SourceFunction) => {
                                this.sourceFunction = sf; return this.fileSystemService.getFileContents(sf.sourcePath)
                            }),
                        Observable.of(ds.getTrace(executionId)));
                })
                .mergeMap(([fileContents, traces]) => {
                    this.lines = fileContents.split('\n')
                        .filter((l, i) => this.sourceFunction && i >= (this.sourceFunction.lineStart - 1) && i < (this.sourceFunction.lineStart - 1 + this.sourceFunction.lineCount))
                        .map(l => { return { sourceCode: l, traces: [] } });
                    this.lastTraceLine = Number.POSITIVE_INFINITY;
                    this.traceColCount = 0;
                    this.lines.forEach((_, i) => {
                        MatchMaxHeightDirective.markDirty(`debugger-${i}`);
                    });
                    return Observable.from(traces);
                })
                .subscribe({
                    next: (t: Trace) => {
                        this.addTrace(t);
                    },
                    complete: () => { },
                    error: (error: Response) => {
                        console.error(error);
                    }
                });
        }
        else {
            console.error('Not attached');
        }
    }

    public addTrace(trace: Trace) {
        if (trace.data.tType === 'call') {
            //TODO: properly handle these
            return;
        }
        if (this.sourceFunction) {
            let line = this.lines[trace.line - this.sourceFunction.lineStart];
            if (this.lastTraceLine >= trace.line) {
                this.traceColCount++;
            }

            line.traces[this.traceColCount - 1] = trace;

            this.lastTraceLine = trace.line;

            MatchMaxHeightDirective.markDirty(`debugger-${trace.line - this.sourceFunction.lineStart}`);
        }
    }

    public ExecuteFunction() {
        if (this.debugState && this.sourceFunction) {
            this.resetGraph();
            console.log(this.setParameters);
            this.debugState.executeFunction(this.sourceFunction.address, this.setParameters)
                .subscribe((ex: Execution) => {
                    this.displayTrace(ex.id);
                }, (e: any) => {
                    console.error(e);
                });
        } else {
            this.snackBar.open('No breakpoint set.', undefined, {
                duration: 3000
            });
        }
    }

    public resetGraph() {
        this.showGraph = false;
        this.graphVariable = "";
        this.variables = new Set();
    }

    public GetFunctionAsString(): string {
        if (!this.sourceFunction) {
            return 'No Function Selected';
        } else {
            return this.sourceFunction.name + ' ' + this.sourceFunction.getParametersAsString();
        }
    }

    public GoToFunctionsView() {
        this.viewService.activeView = 'functions';
    }

    public SetGraphVariable(variableName: string): void {
        if (this.currentExecution !== null) {
            this.graphData = [];
            this.graphVariable = variableName;
            this.showGraph = true;
            this.lineGraph.onDataUpdated();

            if (this.debugState && this.currentExecution !== null) {
                let graphUpdates = Observable.create((observer: Subscriber<Trace>) => {
                    this.debugState!.getTrace(this.currentExecution!).subscribe(
                        (t: Trace) => {
                            if (t.data.tType === 'line') {
                                t.data.state.filter((s: TraceState) => s.sVariable === variableName)
                                    .forEach((s: TraceState) => {
                                        this.graphData.push({ x: this.graphData.length, y: parseInt(s.value) });
                                        observer.next();
                                    });
                            }
                        },
                        (error: Response) => {
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
