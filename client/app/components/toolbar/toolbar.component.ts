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

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    public debugState:DebuggerState | null;
    public debugStateFile: SourceFile | null;

    selectedView:string;

    constructor(public dialog: MdDialog,
                public viewService:ViewService,
                private snackBar: MdSnackBar) {
        this.debugState = null;
        this.debugStateFile = null;
        this.selectedView = 'launcher';
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
                    return this.debugState.getTrace(ex.id);
                }).map((t:Trace)=> {
                if(t.tType === 2) {
                    let tTerm: TraceOfTermination = t as TraceOfTermination;
                    if (tTerm.data.cause === 'breakpoint') {
                        if (this.viewService.debuggerComponent) {
                            this.viewService.debuggerComponent.setParameters = {};
                            this.viewService.debuggerComponent.displayTrace(tTerm.data.nextExecution);
                            this.viewService.activeView = "Debugger";
                        }
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

    public KillAndDetach() {
        if(this.debugState) {
            //TODO: When the api for detach exists do something for this.
            this.snackBar.open("Killing and detaching not yet implemented.", undefined, {
                duration: 1000
            });
        }
    }


    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}