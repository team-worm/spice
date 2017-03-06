import { Component, ViewChild, OnInit } from '@angular/core';
import { ViewService } from "../services/view.service";
import { DebuggerComponent } from "./debugger/debugger.component";
import { FunctionsComponent } from "./functions/functions.component";
import { ToolbarComponent } from "./toolbar/toolbar.component";
import { LauncherComponent } from "./launcher/launcher.component";

@Component({
    selector: 'spice-root',
    template: `
<div [class.spicy-dark]="isDarkTheme">
<spice-toolbar (isDarkTheme)="onToggleTheme($event)"></spice-toolbar>
<spice-launcher [hidden]="!IsInLauncher()"></spice-launcher>
<spice-configuration [hidden]="!IsInFunctions()"></spice-configuration>
<spice-debugger [hidden]="!IsInDebugger()"></spice-debugger>
</div>
`,
})
export class SpiceRootComponent implements OnInit {
    isDarkTheme: boolean = false;

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

    public onToggleTheme(isDark: boolean) {
        this.isDarkTheme = isDark;
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
