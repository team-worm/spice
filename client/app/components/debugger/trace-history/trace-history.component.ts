import {Component} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {MdSidenav} from "@angular/material";
import {Execution, FunctionData } from "../../../models/Execution";
import {SourceFunction} from "../../../models/SourceFunction";
import {ViewService} from "../../../services/view.service";
import { DebuggerService } from "../../../services/debugger.service";

@Component({
    selector: 'trace-history',
    template: `
<div class="trace-history-sidenav">
    <h2><md-icon>history</md-icon> Execution Traces</h2>
    <md-list>
        <md-list-item *ngFor="let e of executions.reverse()" (click)="ReplayTrace(e)">
            <md-icon md-list-icon>{{GetListIcon(e)}}</md-icon>
            <h3 md-line><b>#{{e.debugSessId}}</b> : {{GetListTitle(e)}}</h3>
        </md-list-item>
    </md-list>
</div>`,
})

export class TraceHistoryComponent {
    public debugState:DebuggerState | null = null;
    public sidenav:MdSidenav | null;

    public executions: { ex: Execution, func: SourceFunction | null, debugSessId: number }[] = [];

	constructor(private debuggerService: DebuggerService,
				private viewService:ViewService) {
	}

    public Toggle() {
    	if(this.debuggerService.currentDebuggerState && this.sidenav) {
    		if(this.sidenav.opened) {
    			this.sidenav.close();
			} else {
                this.executions = [];

                var createExecution = function(e: Execution, sessid: number, ds: DebuggerService) {
                    return {
                        ex: e,
                        func: ds!.debuggerStates!.get(sessid) !.sourceFunctions!.get((e.data as FunctionData).sFunction) || null, debugSessId: sessid
                    }
                };

                Array.from(this.debuggerService.debuggerStates.values())
                    .map(debugState => {
                        return {
                            exs: Array.from(debugState.executions.values()).filter(ex => ex.data.eType === 'function')
                            , sessId: debugState.info.id
                        }
                    }).forEach(exObj => {
                        var sessId = exObj.sessId;
                        var ds = this.debuggerService;
                        var test = exObj.exs.map(function(e) { return createExecution(e, sessId, ds) });
                        this.executions = this.executions.concat(test);
                    });

				this.sidenav.open();
			}
		}
    }

    public GetListTitle(e: { ex: Execution, func: SourceFunction | null, debugSessId: number }): string {
        if (e.func && this.debuggerService.debuggerStates.get(e.debugSessId)
            && this.debuggerService.debuggerStates.get(e.debugSessId) !.sourceTypes) {
            let stMap = this.debuggerService.debuggerStates.get(e.debugSessId) !.sourceTypes;
            const parameters = e.func.parameters
                .map(parameter => {
                    const t = stMap.get(parameter.sType);
                    `${t ? t.toString(stMap) : ""} ${parameter.name}`
                })
                .join(", ");
            return  `${e.func.name}(${parameters})`;
        } else {
            return 'Process';
        }
    }

    public GetListIcon(e:{ex: Execution, func: SourceFunction | null}):string {
        if(e.ex.data.eType === 'function') {
            return 'library_books'
        } else {
            return 'settings'
        }
    }

    public ReplayTrace(e: { ex: Execution, func: SourceFunction | null, debugSessId: number }) {
        this.viewService.debuggerComponent!.DisplayOldTrace(e.ex, e.debugSessId);
        //this.debuggerService.displayTrace(e.ex);
    }

}
