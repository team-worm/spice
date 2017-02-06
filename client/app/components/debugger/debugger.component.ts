import {Component} from "@angular/core";
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

export class DebuggerComponent {

	protected lines: { sourceCode: string, traces: Trace[]}[];
	protected lastTraceLine: number;
	protected traceColCount: number;
	constructor(private debuggerService: DebuggerService, private fileSystemService: FileSystemService, private viewService: ViewService) {
		this.lastTraceLine = Number.POSITIVE_INFINITY;
		this.traceColCount = 0;
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
			Observable.of(new ExecutionOfFunction(executionId, 'executing', 0, {sFunction: sf}))
                .mergeMap((ex: Execution) => {
					if(ex.eType !== 'function') {
						return Observable.throw(new Error(`DebuggerComponent: cannot display execution traces with type ${ex.eType}`));
					}
					return Observable.forkJoin(
						this.fileSystemService.getFileContents((ex as ExecutionOfFunction).data.sFunction.sourcePath),
						Observable.of(ds.getTrace(executionId)));
				})
				.mergeMap(([fileContents, traces]) => {
					this.lines = fileContents.split('\n').map(l => {return { sourceCode: l, traces: []}});
					//TODO: figure out how to do this without a delay
					Observable.of(null).delay(100).subscribe(() => this.refreshHeights());
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

	public refreshHeights(): void {
		this.lines.forEach((l,i) => MatchMaxHeightDirective.update('debugger-'+i.toString()));
	}

	public addTrace(trace: Trace) {
		let line = this.lines[trace.line - 1];
		if(this.lastTraceLine >= trace.line) {
			this.traceColCount++;
		}

		line.traces[this.traceColCount-1] = trace;

		this.lastTraceLine = trace.line;

		//TODO: figure out how to do this without a delay
		Observable.of(null).delay(100).subscribe(() => MatchMaxHeightDirective.update('debugger-'+(trace.line-1).toString()));
	}
}
