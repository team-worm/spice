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
            <h3 md-line><b>#{{e.ex.id}}</b> : {{GetListTitle(e)}}</h3>
        </md-list-item>
    </md-list>
</div>`,
})

export class TraceHistoryComponent {
    public debugState:DebuggerState | null = null;
    public sidenav:MdSidenav | null;

    public executions:{ex: Execution, func: SourceFunction | null}[] = [];

	constructor(private debuggerService: DebuggerService,
				private viewService:ViewService) {
	}

    public Toggle() {
    	if(this.debuggerService.currentDebuggerState && this.sidenav) {
    		if(this.sidenav.opened) {
    			this.sidenav.close();
			} else {
				this.executions = Array.from(this.debuggerService.currentDebuggerState.executions.values())
					.filter(ex => ex.data.eType === 'function')
					.map(ex => { return { ex: ex, func: this.debuggerService.currentDebuggerState!.sourceFunctions.get((ex.data as FunctionData).sFunction) || null };});
				this.sidenav.open();
			}
		}
    }

    public GetListTitle(e:{ex: Execution, func: SourceFunction | null}):string {
        if(!!e.func) {
            return e.func.getAsStringWithParameters();
        } else {
            return 'Process'
        }
    }

    public GetListIcon(e:{ex: Execution, func: SourceFunction | null}):string {
        if(e.ex.data.eType === 'function') {
            return 'library_books'
        } else {
            return 'settings'
        }
    }

    public ReplayTrace(e:{ex: Execution, func: SourceFunction | null}) {
		this.debuggerService.displayTrace(e.ex);
    }

}
