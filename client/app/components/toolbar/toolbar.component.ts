import {Component} from "@angular/core";
import { Response } from "@angular/http";
import {MdDialog, MdSnackBar} from "@angular/material";
import {AboutComponent} from "./about.component";
import {HelpComponent} from "./help.component";
import {ViewService} from "../../services/view.service";
import {DebuggerState} from "../../models/DebuggerState";
import {Execution} from "../../models/Execution";
import {Observable} from "rxjs/Observable";
import {Trace} from "../../models/Trace";
import {SourceFunction, SourceFunctionId} from "../../models/SourceFunction";
import { DebuggerService } from "../../services/debugger.service";
import { Breakpoint } from "../../models/Breakpoint";

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    public debugState:DebuggerState | null = null;
    public debugProcessName: string = '';
    public bpFunctions:SourceFunction[] = [];
    public execution: Execution | null = null; //TODO: get this data from the service

    constructor(public dialog: MdDialog,
                public viewService:ViewService,
                public debuggerService:DebuggerService,
                private snackBar: MdSnackBar) {}

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
                    switch (t.data.tType) {
                    case "break":
                        if (this.viewService.debuggerComponent) {
                            this.viewService.debuggerComponent.setParameters = {};
                            this.viewService.debuggerComponent.displayTrace(t.data.nextExecution);
                            this.viewService.activeView = 'debugger';
                            if(this.debugState) {
								this.debugState.getExecution(t.data.nextExecution).subscribe((ex: Execution) => { this.execution = ex; });
							}
                        }
                        break;

                    case "exit":
						this.OnExecutionStopped();
                        break;
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
			this.debugState.getBreakpoints().subscribe((breakpoints: Map<SourceFunctionId, Breakpoint>) => {
				this.debuggerService.attachBinary(launchedFile.path).subscribe(
					(ds: DebuggerState) => { 
						if(this.viewService.launcherComponent) {
							this.viewService.launcherComponent.onAttach(ds, launchedFile.name); 
							breakpoints.forEach((breakpoint, bId) => {
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
    public GetBpFunctions() {
        if(this.debugState) {
            this.bpFunctions = [];

            for(let key of this.debugState.breakpoints.keys()) {
                this.debugState.sourceFunctions.get(key).subscribe((sf:SourceFunction)=>{
                    this.bpFunctions.push(sf);
                })
            }
        }
    }
    public BreakpointFunctionSelected(func:SourceFunction) {
        this.GoToFunctionsView();
        if(this.viewService.functionsComponent) {
            this.viewService.functionsComponent.OnFunctionSelected(func);
        }
    }
    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}
