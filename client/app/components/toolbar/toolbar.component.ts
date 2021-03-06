import {Component, EventEmitter, Output} from "@angular/core";
import {Response} from "@angular/http";
import {MdDialog, MdSnackBar} from "@angular/material";
import {AboutComponent} from "./about.component";
import {ViewService} from "../../services/view.service";
import {SourceFunction} from "../../models/SourceFunction";
import {DebuggerService, ExecutionEvent, ProcessEndedEvent} from "../../services/debugger.service";

/** Toolbar Component
 * Allows the user to control global debugger state, including starting and
 * stopping execution and detaching the debugger.
 */
@Component({
    moduleId: module.id,
    selector: 'spice-toolbar',
    templateUrl: './toolbar.component.html'
})
export class ToolbarComponent {

    @Output() isDarkTheme = new EventEmitter<boolean>();
    private dark: boolean = false;
    public bpFunctions: SourceFunction[] = [];

    constructor(public dialog: MdDialog,
                public viewService: ViewService,
                public debuggerService: DebuggerService,
                private snackBar: MdSnackBar) {
        this.debuggerService.getEventStream(['execution']).subscribe((event: ExecutionEvent) => this.onExecution(event));
    }

    public IsInFunctionView(): boolean {
        return this.viewService.activeView === 'functions';
    }

    public IsInLauncherView(): boolean {
        return this.viewService.activeView === 'launcher';
    }

    public IsFunctionExecution(): boolean {
        return !!this.debuggerService.currentExecution
            && this.debuggerService.currentExecution.data.eType === 'function';
    }

    public GoToFunctionsView() {
        this.debuggerService.displayFunction(null);
    }

    public ToggleTraceHistory() {
        if (this.viewService.traceHistoryComponent) {
            this.viewService.traceHistoryComponent.Toggle();
        }
    }

    public toggleDarkTheme() {
        this.isDarkTheme.emit(!this.dark);
        this.dark = !this.dark;
    }

    public ContinueExecution() {
        this.debuggerService.continueExecution('', '').subscribe(
            () => {
            },
            (error: Response) => {
                this.snackBar.open('Error continuing execution (' + error.status + '): ' + error.statusText, undefined, {
                    duration: 3000
                });
                if ((<any>error).message) {
                    console.error(error);
                }
            }
        );
    }

    public StopExecution() {
        this.debuggerService.stopCurrentExecution().subscribe(
            () => {
            },
            (error: Response) => {
                this.snackBar.open('Error stopping execution (' + error.status + '): ' + error.statusText, undefined, {
                    duration: 3000
                });
                if ((<any>error).message) {
                    console.error(error);
                }
            }
        );
    }

    public KillProcess() {
        if (!!this.debuggerService.currentExecution) {
            this.StopExecution();
        }

        this.debuggerService.killProcess().subscribe(
            () => {
            },
            (e: any) => {
                this.snackBar.open('Error Stopping Process', undefined, {
                    duration: 3000
                });
            }
        );
    }

    public Detach() {
        this.debuggerService.detach().subscribe(
            () => {
            },
            (err) => {
                console.error(err);
            }
        );
    }

    public onExecution(event: ExecutionEvent) {

    }

    public onProcessEnded(event: ProcessEndedEvent) {
    }

    public GetBpFunctions() {
        this.bpFunctions = Array.from(this.debuggerService.currentDebuggerState!.breakpoints.values())
            .map(b => this.debuggerService.currentDebuggerState!.sourceFunctions.get(b.sFunction)!);
    }

    public BreakpointFunctionSelected(func: SourceFunction) {
        this.debuggerService.displayFunction(func);
    }

    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }

    public canDetach(): boolean {
        return !!this.debuggerService.currentDebuggerState;
    }

    public isAttached(): boolean {
        return !!this.debuggerService.currentDebuggerState;
    }

    public canStart(): boolean {
        return !!this.debuggerService.currentDebuggerState &&
            !!this.viewService.debuggerComponent &&
            !this.viewService.debuggerComponent.currentExecution;
    }

    public canContinue(): boolean {
        return !!this.debuggerService.currentDebuggerState &&
            !!this.viewService.debuggerComponent &&
            !!this.viewService.debuggerComponent.currentExecution;
    }

    public canStopExecution(): boolean {
        return !!this.debuggerService.currentDebuggerState && !!this.debuggerService.currentExecution;
    }

    public canKillProcess(): boolean {
        return !!this.debuggerService.currentDebuggerState;
    }

    public processName(): string {
        return (this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.name) || '';
    }

    public breakpointCount(): number {
        return (this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.breakpoints.size) || 0;
    }

    public executionCount(): number {
        let executionCount = 0;
        for (const debugState of this.debuggerService.debuggerStates.values()) {
            for (const execution of debugState.executions.values()) {
                if (execution.data.eType === 'function') {
                    executionCount += 1;
                }
            }
        }
        return executionCount;
    }

    public isMaximized(): boolean {
        return false;
    }

    public Minimize() {
    }

    public Maximize() {
    }

    public Close() {
    }
}
