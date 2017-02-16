import {Component} from "@angular/core";
import {MdDialog, MdSnackBar} from "@angular/material";
import {AboutComponent} from "./about.component";
import {HelpComponent} from "./help.component";
import {ViewService} from "../../services/view.service";
import {DebuggerState} from "../../models/DebuggerState";
import {SourceFile} from "../../models/SourceFile";
import {Execution} from "../../models/execution/Execution";
import {Observable} from "rxjs/Observable";
import {Trace} from "../../models/trace/Trace";
import {TraceOfTermination} from "../../models/trace/TraceOfTermination";
import { DebuggerService } from "../../services/debugger.service";
import { Response } from "@angular/http";

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    public debugState:DebuggerState | null;
    public debugProcessName: string;
    public execution: Execution | null; //TODO: get this data from the service

    selectedView:string;

    constructor(public dialog: MdDialog,
                public viewService:ViewService,
                public debuggerService:DebuggerService,
                private snackBar: MdSnackBar) {
        this.debugState = null;
        this.debugProcessName = '';
        this.selectedView = 'launcher';
        this.execution = null;
    }

    public GoToFunctionsView() {
        this.viewService.activeView = 'functions';
    }

    public ExecuteBinary() {
        if(this.debugState) {
            this.debugState.executeBinary('','')
                .mergeMap((ex:Execution)=>{
                    if(!this.debugState) {
                        return Observable.throw(new Error('Null debug state'));
                    }
					this.execution = ex;
                    return this.debugState.getTrace(ex.id);
                }).map((t:Trace)=> {
                if(t.tType === 2) {
                    let tTerm: TraceOfTermination = t as TraceOfTermination;
                    if (tTerm.data.cause === 'breakpoint') {
                        if (this.viewService.debuggerComponent) {
                            this.viewService.debuggerComponent.setParameters = {};
                            this.viewService.debuggerComponent.displayTrace(tTerm.data.nextExecution);
                            this.viewService.activeView = 'debugger';
                            if(this.debugState) {
								this.debugState.getExecution(tTerm.data.nextExecution).subscribe((ex: Execution) => { this.execution = ex; });
							}

                        }
                    } else if(tTerm.data.cause === 'exit') {
						this.OnExecutionStopped();
					}
                }
                return t;
            }).subscribe({
                next: (t)=>{},
                complete: ()=>{},
                error: (error:any) => {
                    console.log(error);
                    this.snackBar.open('Error getting Source Functions', undefined, {
                        duration: 3000
                    });
                }
            });
        } else {
            this.snackBar.open('No breakpoint set.', undefined, {
                duration: 3000
            });
        }
    }

    public StopExecution() {
    	if(this.debugState && this.execution) {
			this.debugState.stopExecution(this.execution.id)
				.subscribe(
					(ex: Execution) => {
						this.OnExecutionStopped();
					}, 
					(error: Response) => {
						this.snackBar.open('Error stopping execution (' + error.status + '): ' + error.statusText, undefined, {
							duration: 3000
						});
						if ((<any>error).message) {
							console.error(error);
						}
					});
		}
	}

	public OnExecutionStopped() {
		this.execution = null;

		//auto reattach
		if(this.debugState && this.viewService.launcherComponent && this.viewService.launcherComponent.launchedFile) {
			let launchedFile = this.viewService.launcherComponent.launchedFile;
			//save breakpoints
			this.debugState.getBreakpoints().subscribe((breakpoints) => {
				this.debuggerService.attachBinary(launchedFile.path).subscribe(
					(ds: DebuggerState) => { 
						if(this.viewService.launcherComponent) {
							this.viewService.launcherComponent.onAttach(ds, launchedFile.name); 
							Object.keys(breakpoints).forEach(bId => {
								ds.setBreakpoint(bId).subscribe(
									()=>{},
									(error)=>{
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
	}

    public KillAndDetach() {
        if(this.debugState) {
            //TODO: When the api for kill+detach exists do something for this.
            if(this.viewService.launcherComponent) {
				this.viewService.launcherComponent.onDetach();
			}
        }
    }

    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}
