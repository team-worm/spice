import {Component} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {MdSidenav} from "@angular/material";
import {Execution} from "../../../models/Execution";

@Component({
    selector: 'trace-history',
    template: `
<div class="trace-history-sidenav">
    <h2>Trace History</h2>
    <div *ngFor="let e of executions">Execution {{e.id}} : {{e.data.eType}}</div>
</div>`,
})

export class TraceHistoryComponent {
    public debugState:DebuggerState | null = null;
    public sidenav:MdSidenav | null;

    public executions:Execution[] = [];
    constructor() {
    }

    public Toggle() {
        if(this.debugState && this.sidenav) {
            if(this.sidenav.opened) {
                this.sidenav.close();
            } else {
                this.executions = [];

                for(let k of this.debugState.executions.keys()) {
                    this.debugState.executions.get(k).subscribe((e:Execution) => {
                        this.executions.push(e);
                    })
                }

                this.sidenav.open();
            }

        }
    }
}