import { Component } from "@angular/core";
import { DebuggerService } from "../../services/debugger.service";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution, ExecutionId } from "../../models/Execution";
import { Trace } from "../../models/Trace";
import { Observable } from "rxjs/Observable";
import { SourceFunction } from "../../models/SourceFunction";
import { MatchMaxHeightDirective } from "../../directives/MatchMaxHeight.directive";
import { Response } from "@angular/http";
import { ViewService } from "../../services/view.service";
import { FileSystemService } from "../../services/file-system.service";
import { MdSnackBar } from "@angular/material";

@Component({
	selector: 'spice-debugger',
	templateUrl: 'app/components/debugger/debugger.component.html'
})
export class DebuggerComponent {

	protected lines: { sourceCode: string, traces: Trace[]}[];
	protected lastTraceLine: number;
	protected traceColCount: number;

	public sourceFunction: SourceFunction | null;
	public debugState: DebuggerState | null;
	public setParameters:{[id: string]: any};

	constructor(private debuggerService: DebuggerService,
				private fileSystemService: FileSystemService,
				private viewService: ViewService,
				private snackBar: MdSnackBar) {

		this.viewService.debuggerComponent = this;
		this.lastTraceLine = Number.POSITIVE_INFINITY;
		this.traceColCount = 0;
		this.lines = [];
		this.sourceFunction = null;
		this.setParameters = {};
	}

	public displayTrace(executionId: ExecutionId) {
		if(this.debugState) {
			let ds: DebuggerState = this.debugState;
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
						.filter((l,i) => this.sourceFunction && i>=(this.sourceFunction.lineStart-1) && i<(this.sourceFunction.lineStart-1 + this.sourceFunction.lineCount))
						.map(l => {return { sourceCode: l, traces: []}});
					this.lastTraceLine = Number.POSITIVE_INFINITY;
					this.traceColCount = 0;
					this.lines.forEach((_, i) => {
						MatchMaxHeightDirective.markDirty(`debugger-${i}`);
					});
					return ds.getTrace(executionId)
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
		if(this.sourceFunction) {
			let line = this.lines[trace.line - this.sourceFunction.lineStart];
			if(this.lastTraceLine >= trace.line) {
				this.traceColCount++;
			}

			line.traces[this.traceColCount-1] = trace;

			this.lastTraceLine = trace.line;

			MatchMaxHeightDirective.markDirty(`debugger-${trace.line-this.sourceFunction.lineNumber}`);
		}
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
}
