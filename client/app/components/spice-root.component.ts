import { Component, ViewChild, OnInit } from '@angular/core';
import { ViewService } from "../services/view.service";
import { DebuggerComponent } from "./debugger/debugger.component";
import { FunctionsComponent } from "./functions/functions.component";
import { ToolbarComponent } from "./toolbar/toolbar.component";
import { LauncherComponent } from "./launcher/launcher.component";
import { MdSidenav } from "@angular/material";
import { TraceHistoryComponent } from "./debugger/trace-history/trace-history.component";
import { ErrorEvent, DebuggerService } from "../services/debugger.service";
import { MdSnackBar } from "@angular/material";
import { displaySnackbarError } from "../util/SnackbarError";

@Component({
    selector: 'spice-root',
    template: `
<span [class.spicy-dark]="isDarkTheme">
    <spice-toolbar></spice-toolbar>
    <md-sidenav-container>
        <spice-launcher [hidden]="!IsInLauncher()"></spice-launcher>
        <spice-configuration [hidden]="!IsInFunctions()"></spice-configuration>
        <spice-debugger [hidden]="!IsInDebugger()"></spice-debugger>
        <md-sidenav #traceHistory [align]="'end'"><trace-history></trace-history></md-sidenav>
    </md-sidenav-container>
</span>
`,
})
export class SpiceRootComponent implements OnInit {
    isDarkTheme: boolean = false;

    @ViewChild(ToolbarComponent) toolbarComponent: ToolbarComponent;
    @ViewChild(LauncherComponent) launcherComponent: LauncherComponent;
    @ViewChild(FunctionsComponent) functionsComponent: FunctionsComponent;
    @ViewChild(DebuggerComponent) debuggerComponent: DebuggerComponent;
    @ViewChild(TraceHistoryComponent) traceHistoryComponent: TraceHistoryComponent;

    @ViewChild(MdSidenav) traceHistory: MdSidenav;

    constructor(private viewService: ViewService,
        private debuggerService: DebuggerService,
        private snackBar: MdSnackBar) {
        this.debuggerService.getEventStream(['error']).subscribe((event: ErrorEvent) => displaySnackbarError(this.snackBar, event.cause, event.error));
    }

    ngOnInit() {
        this.viewService.rootComponent = this;
        this.viewService.toolbarComponent = this.toolbarComponent;
        this.viewService.launcherComponent = this.launcherComponent;
        this.viewService.functionsComponent = this.functionsComponent;
        this.viewService.debuggerComponent = this.debuggerComponent;
        this.viewService.traceHistoryComponent = this.traceHistoryComponent;
        this.traceHistoryComponent.sidenav = this.traceHistory;
    }

    public SetTheme(theme: string) {
        this.isDarkTheme = !this.isDarkTheme;

        var links = document.getElementsByTagName("link");

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (link.getAttribute("href") === 'prism_light.css' && this.isDarkTheme) {
                link.setAttribute("href", 'prism_dark.css');
            } else if (link.getAttribute("href") === 'prism_dark.css' && !this.isDarkTheme) {
                link.setAttribute("href", 'prism_light.css');
            }
        }
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
