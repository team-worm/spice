import {Component, ViewChild, OnInit} from '@angular/core';
import {ViewService} from "../services/view.service";
import {DebuggerComponent} from "./debugger/debugger.component";

@Component({
    selector: 'spice-root',
    template: `
<spice-toolbar></spice-toolbar>
<spice-launcher [hidden]="!IsInLauncher()"></spice-launcher>
<spice-configuration [hidden]="!IsInConfiguration()"></spice-configuration>
<spice-debugger [hidden]="!IsInDebugger()"></spice-debugger>
`,
})
export class SpiceRootComponent implements OnInit {

    @ViewChild(DebuggerComponent) debuggerComponent: DebuggerComponent;
    constructor(private viewService:ViewService) {}

    ngOnInit() {
        this.viewService.debuggerComponent = this.debuggerComponent;
    }

    public IsInLauncher():boolean {
        return this.viewService.activeView == 'launcher';
    }

    public IsInConfiguration():boolean {
        return this.viewService.activeView == 'configuration';
    }

    public IsInDebugger():boolean {
        return this.viewService.activeView == 'debugger';
    }
}
