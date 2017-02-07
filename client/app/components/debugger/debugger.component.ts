import {Component, AfterViewChecked} from "@angular/core";
import { DebuggerService } from "../../services/debugger.service";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution } from "../../models/execution/Execution";
import { Trace } from "../../models/trace/Trace";
import { Observable } from "rxjs/Observable";
import {SourceFunction} from "../../models/SourceFunction";
import { MatchMaxHeightDirective } from "../../directives/MatchMaxHeight.directive";
import { Response } from "@angular/http";
import {ViewService} from "../../services/view.service";
import {ExecutionId} from "../../models/execution/ExecutionId";
import {ExecutionOfFunction} from "../../models/execution/ExecutionOfFunction";
import {FileSystemService} from "../../services/file-system.service";
@Component({
	selector: 'spice-debugger',
	templateUrl: 'app/components/debugger/debugger.component.html'
})

export class DebuggerComponent implements AfterViewChecked {

	protected lines: { sourceCode: string, traces: Trace[]}[];
	protected sourceFunction: SourceFunction | null;
	protected lastTraceLine: number;
	protected traceColCount: number;
	protected heightsDirty: number[]; //line indexes that are dirty
	constructor(private debuggerService: DebuggerService, private fileSystemService: FileSystemService, private viewService: ViewService) {
		this.lastTraceLine = Number.POSITIVE_INFINITY;
		this.traceColCount = 0;
		this.heightsDirty = [];
		this.lines = [];
		this.sourceFunction = null;
	}

	ngAfterViewChecked() {
		//console.log('a');
		//console.log(this.heightsDirty);
		//this.heightsDirty.forEach(line => MatchMaxHeightDirective.update(`debugger-${line}`));
		//console.log(this.lines);
		//TODO: fix this so it doesn't just execute on any update
		this.lines.forEach((l,i) => MatchMaxHeightDirective.update('debugger-'+i.toString()));
		this.heightsDirty = [];
	}


	//TODO: remove sf from parameters when server is fixed
	public displayTrace(executionId: ExecutionId, sf: SourceFunction | null) {
		if(!sf) {
			throw new Error('DebuggerComponent: displayTrace: sf required');
		}
		let debuggerState:DebuggerState|null = this.debuggerService.getCurrentDebuggerState();
		if(debuggerState) {
			let ds: DebuggerState = debuggerState;
			//TODO: uncomment when getExecution is implemented on server
			//ds.getExecution(executionId)
			Observable.of(new ExecutionOfFunction(executionId, 'executing', 0, {sFunction: sf.id}))
                .mergeMap((ex: Execution) => {
					if(ex.eType !== 'function') {
						return Observable.throw(new Error(`DebuggerComponent: cannot display execution traces with type ${ex.eType}`));
					}
					return Observable.forkJoin(
						ds.getSourceFunction((ex as ExecutionOfFunction).data.sFunction)
						.mergeMap((sf:SourceFunction) => {
							this.sourceFunction = sf; return this.fileSystemService.getFileContents(sf.sourcePath)}),
						Observable.of(ds.getTrace(executionId)));
				})
				.mergeMap(([fileContents, traces]) => {
					this.lines = fileContents.split('\n')
						.filter((l,i) => this.sourceFunction && i>=(this.sourceFunction.lineNumber-1) && i<(this.sourceFunction.lineNumber-1 + this.sourceFunction.lineCount))
						.map(l => {return { sourceCode: l, traces: []}});
					this.lastTraceLine = Number.POSITIVE_INFINITY;
					this.traceColCount = 0;
					this.heightsDirty = Array.apply(null, [].constructor(this.lines.length)).map((_: number,i: number) => i);
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
			let line = this.lines[trace.line - this.sourceFunction.lineNumber];
			if(this.lastTraceLine >= trace.line) {
				this.traceColCount++;
			}

			line.traces[this.traceColCount-1] = trace;

			this.lastTraceLine = trace.line;

			this.heightsDirty.push(trace.line-this.sourceFunction.lineNumber);
		}
	}
}
