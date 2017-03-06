import {Component} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {MdSidenav} from "@angular/material";
import {Execution} from "../../../models/Execution";
import {SourceFunction} from "../../../models/SourceFunction";
import {ViewService} from "../../../services/view.service";

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

    constructor(private viewService:ViewService) {}

    public Toggle() {
        if(this.debugState && this.sidenav) {
            if(this.sidenav.opened) {
                this.sidenav.close();
            } else {
                this.executions = [];

                for(let k of this.debugState.executions.keys()) {
                    this.debugState.executions.get(k).subscribe((e:Execution) => {
                        if(this.debugState && e.data.eType === "function") {
                            this.debugState.sourceFunctions.get(e.data.sFunction).subscribe((sf:SourceFunction)=>{
                                this.executions.push({
                                    ex: e,
                                    func: sf
                                });
                            })
                        } else {
                            this.executions.push({
                                ex: e,
                                func: null
                            });
                        }

                    })
                }

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
        if(this.viewService.debuggerComponent) {
            this.viewService.debuggerComponent.DisplayTrace(e.ex.id);
            this.viewService.activeView = 'debugger';
        }
    }

}