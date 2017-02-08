import {Component, ViewChild, OnInit} from '@angular/core';
import {ViewService} from "../services/view.service";
import {DebuggerComponent} from "./debugger/debugger.component";
import {FunctionsComponent} from "./functions/functions.component";
import {ToolbarComponent} from "./toolbar/toolbar.component";
import {LauncherComponent} from "./launcher/launcher.component";

@Component({
    selector: 'spice-root',
    template: `
<spice-toolbar></spice-toolbar>
<spice-launcher [hidden]="!IsInLauncher()"></spice-launcher>
<spice-configuration [hidden]="!IsInFunctions()"></spice-configuration>
<spice-debugger [hidden]="!IsInDebugger()"></spice-debugger>
`,
})
export class SpiceRootComponent implements OnInit {


    @ViewChild(ToolbarComponent) toolbarComponent: ToolbarComponent;
    @ViewChild(LauncherComponent) launcherComponent: LauncherComponent;
    @ViewChild(FunctionsComponent) functionsComponent: FunctionsComponent;
    @ViewChild(DebuggerComponent) debuggerComponent: DebuggerComponent;

    constructor(private viewService: ViewService) {
    }

    ngOnInit() {
        this.viewService.toolbarComponent = this.toolbarComponent;
        this.viewService.launcherComponent = this.launcherComponent;
        this.viewService.functionsComponent = this.functionsComponent;
        this.viewService.debuggerComponent = this.debuggerComponent;
    }

    public IsInLauncher(): boolean {
        return this.viewService.activeView == 'launcher';
    }

    public IsInFunctions(): boolean {
        return this.viewService.activeView == 'functions';
    }

    public IsInDebugger(): boolean {
        return this.viewService.activeView == 'debugger';
    }
}
