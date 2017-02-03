import {Component} from "@angular/core";
import { DebuggerService } from "../../services/debugger.service";
import { OnInit } from "@angular/core";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution } from "../../models/execution/Execution";
import { Trace } from "../../models/trace/Trace";
import { TraceOfTermination } from "../../models/trace/TraceOfTermination";
import { Observable } from "rxjs/Observable";
import {SourceFunction} from "../../models/SourceFunction";
@Component({
	selector: 'spice-debugger',
	templateUrl: 'app/components/debugger/debugger.component.html'
})

export class DebuggerComponent implements OnInit {
	constructor(private debuggerService: DebuggerService) {
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
