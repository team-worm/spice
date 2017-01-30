import {Component} from "@angular/core";
import { DebuggerService } from "../../services/debugger.service";
import { OnInit } from "@angular/core";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution } from "../../models/execution/Execution";
import { Trace } from "../../models/trace/Trace";
import { TraceOfTermination } from "../../models/trace/TraceOfTermination";
import { Observable } from "rxjs/Observable";
@Component({
	selector: 'spice-debugger',
	templateUrl: 'app/components/debugger/debugger.component.html'
})

export class DebuggerComponent implements OnInit {
	constructor(private debuggerService: DebuggerService) {
	}

	ngOnInit(): void {
		this.debuggerService.attachBinary('test')
			.mergeMap((ds: DebuggerState) => {
				return ds.executeBinary('', '')
					.switchMap((e: Execution) => ds.getTrace(e.id))
					.mergeMap((t: Trace) => {
						if(t.tType === 2 && (t as TraceOfTermination).data.cause === 'breakpoint') {
							return Observable.of(t).concat(ds.getTrace((t as TraceOfTermination).data.nextExecution));
						} else {
						return Observable.of(t); }
					})
			}).subscribe(t => console.log(t), e => console.log(e));

	}
}
