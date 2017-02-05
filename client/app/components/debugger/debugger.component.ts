import {Component} from "@angular/core";
import { DebuggerService } from "../../services/debugger.service";
import { OnInit } from "@angular/core";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution } from "../../models/execution/Execution";
import { Trace } from "../../models/trace/Trace";
import { TraceOfTermination } from "../../models/trace/TraceOfTermination";
import { Observable } from "rxjs/Observable";
import {SourceFunction} from "../../models/SourceFunction";
import { MatchMaxHeightDirective } from "../../directives/MatchMaxHeight.directive";
import { Response } from "@angular/http";
@Component({
	selector: 'spice-debugger',
	templateUrl: 'app/components/debugger/debugger.component.html'
})

export class DebuggerComponent implements OnInit {

	protected lines: { sourceCode: string, traces: Trace[]}[];
	protected lastTraceLine: number;
	protected traceColCount: number;
	constructor(private debuggerService: DebuggerService) {
		this.lastTraceLine = Number.POSITIVE_INFINITY;
		this.traceColCount = 0;
	}

	public refresh(): void {
		this.lines.forEach((l,i) => MatchMaxHeightDirective.update(i.toString()));
	}
	//
	public load(): void {
		let executionId = '2';
		let sourcePath = 'collatz.c';
		//TODO: get file contents from server
		this.lines =
`int collatz(int n) {
	int t = 0;
	while(n !== 1) {
		if(n % 2 == 0) {
			n /= 2;
		} else {
			n = 3*n + 1;
		}
		t++;
	}
	return t;
}`.split('\n').map(l => {return { sourceCode: l, traces: []}});
		//TODO: figure out how to do this without a delay
		Observable.of(null).delay(100).subscribe(() => this.refresh());
		
		let ds:DebuggerState|null = null;
		if(ds = this.debuggerService.getCurrentDebuggerState()) {
			ds.getTrace(executionId).subscribe({
				next: (t: Trace)=>{
					this.addTrace(t);
				},
				complete: ()=>{},
					error: (error:Response)=>{
					console.error(error);
				}
			})
		} else {
			console.error('Not attached');
		}
	}

	public addTrace(trace: Trace) {
		let line = this.lines[trace.line - 1];
		if(this.lastTraceLine >= trace.line) {
			this.traceColCount++;
		}

		line.traces[this.traceColCount-1] = trace;

		this.lastTraceLine = trace.line;

		//TODO: figure out how to do this without a delay
		Observable.of(null).delay(100).subscribe(() => MatchMaxHeightDirective.update((trace.line-1).toString()));
	}

	ngOnInit(): void {
	// this.debuggerService.attachBinary('testBin/SpiceTestApp.exe')
	// 	.mergeMap((ds: DebuggerState) => {
	// 		return ds.getSourceFunctions()
	// 			.switchMap((sfs: {[id: string]: SourceFunction}) => {
	// 		        let sf = Object.keys(sfs).map(k => sfs[k]).find(s => s.name === 'Add');
	// 		        if(sf) {
	//                         return ds.setBreakpoint(sf.id);
	//                     } else {
	// 		            return Observable.throw(new Error('Add function doesn\'t exist'));
	//                     }
	//                 })
	//                 .switchMap((b) => ds.executeBinary('', ''))
	//                 .switchMap((e: Execution) => ds.getTrace(e.id))
	//                 .mergeMap((t: Trace) => {
	//                     if (t.tType === 2 && (t as TraceOfTermination).data.cause === 'breakpoint') {
	//                         return Observable.of(Observable.of(t).concat(ds.getTrace((t as TraceOfTermination).data.nextExecution))).concatAll();
	//                     } else {
	//                         return Observable.of(t);
	//                     }
	//                 });
	// 	}).subscribe(t => console.log(t), e => console.log(e));

	/**
	  this.debuggerService.attachBinary('testBin/SpiceTestApp.exe')
	  .mergeMap((ds: DebuggerState) => {
	  return ds.getSourceFunctions()
	  .switchMap((sfs: {[id: string]: SourceFunction}) => {
	  let sf = Object.keys(sfs).map(k => sfs[k]).find(s => s.name === 'Add');
	  if(sf) {
	  return ds.setBreakpoint(sf.id);
	  } else {
	  return Observable.throw(new Error('Add function doesn\'t exist'));
	  }
	  })
	  .switchMap((b) => ds.executeBinary('', ''))
	  .switchMap((e: Execution) => {
	  return ds.getTrace(e.id);
	  })
	  .mergeMap((t: Trace) => {
	  if (t.tType === 2 && (t as TraceOfTermination).data.cause === 'breakpoint') {
	  return Observable.of(Observable.of(t).concat(ds.getTrace((t as TraceOfTermination).data.nextExecution))).concatAll();
	  } else {
	  return Observable.of(t);
	  }
	  });
	  }).subscribe(t => console.log(JSON.stringify(t)), e => console.log(e));
	 **/
	}
}
