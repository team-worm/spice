import {Component} from "@angular/core";
import {MdDialog, MdSnackBar} from "@angular/material";
import {AboutComponent} from "./about.component";
import {HelpComponent} from "./help.component";
import {ViewService} from "../../services/view.service";
import {DebuggerState} from "../../models/DebuggerState";
import {SourceFile} from "../../models/SourceFile";
import {Execution} from "../../models/Execution";
import {Observable} from "rxjs/Observable";
import {Trace} from "../../models/Trace";
import {SourceFunction, SourceFunctionId} from "../../models/SourceFunction";

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    public debugState:DebuggerState | null;
    public debugProcessName: string;
    public bpFunctions:SourceFunction[];
    public executing: boolean; //TODO: get this data from the service

    selectedView:string;

    constructor(public dialog: MdDialog,
                public viewService:ViewService,
                private snackBar: MdSnackBar) {
        this.debugState = null;
        this.debugProcessName = '';
        this.selectedView = 'launcher';
        this.executing = false;
        this.bpFunctions = [];
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
					this.executing = true;
                    return this.debugState.getTrace(ex.id);
                }).map((t:Trace)=> {
                    switch (t.data.tType) {
                    case "break":
                        if (this.viewService.debuggerComponent) {
                            this.viewService.debuggerComponent.setParameters = {};
                            this.viewService.debuggerComponent.displayTrace(t.data.nextExecution);
                            this.viewService.activeView = "Debugger";
                        }
                        break;

                    case "exit":
                    	this.executing = false;
                    	//TODO: auto-reattach
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

    public KillAndDetach() {
        if(this.debugState) {
            //TODO: When the api for detach exists do something for this.
            this.snackBar.open("Killing and detaching not yet implemented.", undefined, {
                duration: 1000
            });
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
    public RemoveBreakpointAtFunc(func:SourceFunction) {
        if(this.debugState) {
            this.debugState.removeBreakpoint(func.address).subscribe();
        }
    }

    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}
