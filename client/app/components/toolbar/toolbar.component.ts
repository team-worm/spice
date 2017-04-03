import { Component, Output, EventEmitter } from "@angular/core";
import { Response } from "@angular/http";
import {MdDialog, MdSnackBar, MdSidenav} from "@angular/material";
import { AboutComponent } from "./about.component";
import { ViewService } from "../../services/view.service";
import { DebuggerState } from "../../models/DebuggerState";
import { Execution } from "../../models/Execution";
import { Observable } from "rxjs/Observable";
import { Trace } from "../../models/Trace";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import { DebuggerService, ExecutionEvent, ProcessEndedEvent } from "../../services/debugger.service";
import { Breakpoint } from "../../models/Breakpoint";

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

    public IsInFunctionView():boolean {
        return this.viewService.activeView === 'functions';
    }
    public GoToFunctionsView() {
        this.viewService.activeView = 'functions';
    }
    public ToggleTraceHistory() {
        if(this.viewService.traceHistoryComponent) {
            this.viewService.traceHistoryComponent.Toggle();
        }
    }
    
    public toggleDarkTheme() {
        this.isDarkTheme.emit(!this.dark);
        this.dark = !this.dark;
    }

    public ContinueExecution() {
    	this.debuggerService.continueExecution('', '')
			.subscribe(
				() => {},
				(error: Response) => {
					this.snackBar.open('Error continuing execution (' + error.status + '): ' + error.statusText, undefined, {
						duration: 3000
					});
					if ((<any>error).message) {
						console.error(error);
					}
				});
    }
	public KillProcess() {
		this.debuggerService.killProcess().subscribe(
			() => {},
			(e:any)=> {
				this.snackBar.open('Error Stopping Process', undefined, {
					duration: 3000
				});
			});
	}

	public StopExecution() {
		this.debuggerService.stopCurrentExecution()
			.subscribe(
				() => {},
				(error: Response) => {
					this.snackBar.open('Error stopping execution (' + error.status + '): ' + error.statusText, undefined, {
						duration: 3000
					});
					if ((<any>error).message) {
						console.error(error);
					}
				});
    }

    public onExecution(event: ExecutionEvent) {

	}

	public onProcessEnded(event: ProcessEndedEvent) {
		//auto reattach
        /*
        if (this.debugState && this.viewService.launcherComponent && this.viewService.launcherComponent.launchedFile) {
            let launchedFile = this.viewService.launcherComponent.launchedFile;
            //save breakpoints
            this.debugState.getBreakpoints().subscribe((breakpoints: Map<SourceFunctionId, Breakpoint>) => {
                this.debuggerService.attachBinary(launchedFile.path).subscribe(
                    (ds: DebuggerState) => {
                        if (this.viewService.launcherComponent) {
                            this.viewService.launcherComponent.onAttach(ds, launchedFile.name);
                            breakpoints.forEach((breakpoint, bId) => {
                                ds.setBreakpoint(bId).subscribe(
                                    () => { },
                                    (error) => {
                                        this.snackBar.open('Error Setting Breakpoint ' + bId + ' (' + error.status + '): ' + error.statusText, undefined, {
                                            duration: 3000
                                        });
                                    });
                            });
                            this.viewService.activeView = 'functions';
                        }
                    },
                    (error: Response) => {
                        this.snackBar.open('Error Restarting ' + launchedFile.name + ' (' + error.status + '): ' + error.statusText, undefined, {
                            duration: 3000
                        });
                        if ((<any>error).message) {
                            console.error(error);
                        }
                    });
            });
        } else {
            this.viewService.activeView = 'launcher';
        }
        */
    }

	public Detach() {
		this.debuggerService.killProcess()
			.map(() => this.debuggerService.detach())
			.subscribe(
				() => {},
				(err) => { console.error(err); }
		);
    }

	public GetBpFunctions() {
		this.bpFunctions = Array.from(this.debuggerService.currentDebuggerState!.breakpoints.values())
			.map(b => this.debuggerService.currentDebuggerState!.sourceFunctions.get(b.sFunction)!);
	}

    public BreakpointFunctionSelected(func: SourceFunction) {
        this.GoToFunctionsView();
        if (this.viewService.functionsComponent) {
            this.viewService.functionsComponent.OnFunctionSelected(func);
        }
    }
    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }

	public canDetach(): boolean {
		return !!this.debuggerService.currentDebuggerState;
	}

	public canStart(): boolean {
		return !!this.debuggerService.currentDebuggerState && !this.debuggerService.currentExecution;
	}

	public canContinue(): boolean {
		return !!this.debuggerService.currentDebuggerState && !!this.debuggerService.currentExecution;
	}

	public canStopExecution(): boolean {
		return !!this.debuggerService.currentDebuggerState && !!this.debuggerService.currentExecution;
	}

	public canKillProcess(): boolean {
		return !!this.debuggerService.currentDebuggerState && !!this.debuggerService.currentExecution;
	}

	public processName(): string {
		return (this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.name) || '';
	}

	public breakpointCount(): number {
		return (this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.breakpoints.size) || 0
	}
}
