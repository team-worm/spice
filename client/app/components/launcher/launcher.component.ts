import {Component} from "@angular/core";
import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";
import {DebuggerService} from "../../services/debugger.service";
import {MdSnackBar} from "@angular/material";
import {DebuggerState} from "../../models/DebuggerState";
import {Response} from "@angular/http";
import {ViewService} from "../../services/view.service";

@Component({
    selector: 'spice-launcher',
    templateUrl: 'app/components/launcher/launcher.component.html'
})
export class LauncherComponent {

    public selectedFile: SourceFile | null;
    public selectedProcess: Process | null;
    public debugState:DebuggerState | null;
    public debugStateFile: SourceFile | null;
    public attaching:boolean;

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar,
                private viewService: ViewService) {

        this.selectedFile = null;
        this.selectedProcess = null;
        this.debugState = null;
        this.debugStateFile = null;
        this.attaching = false;
    }

    public OnFileSelected($event:SourceFile) {
        this.selectedFile = $event;
    }
    public OnProcessSelected($event:Process) {
        this.selectedProcess = $event;
    }
    public MoveToConfiguration() {
        this.viewService.activeView = 'configuration';
    }

    public LaunchBinary() {
        if(this.selectedFile) {
            this.attaching = true;

            let self = this;
            let launchedFile = this.selectedFile;
            this.debuggerService.attachBinary(this.selectedFile.path).subscribe({
                next: (ds:DebuggerState)=>{
                    self.debuggerService.setCurrentDebuggerState(ds);
                    self.debugState = ds;
                    self.debugStateFile = launchedFile;
                    self.attaching = false;
                },
                complete: ()=>{
                },
                error: (error:Response)=>{
                    self.attaching = false;
                    self.snackBar.open('Error Launching '+launchedFile.name+' ('+error.status+'): '+error.statusText, undefined, {
                        duration: 3000
                    });
                }
            });
        } else {
            this.snackBar.open("No valid file selected to launch.", undefined, {
                duration: 3000
            });
        }

    }
    public AttachToProcess() {
        this.snackBar.open("Attaching to process not yet implemented.", undefined, {
            duration: 1000
        });
    }

    public KillAndDetach() {
        if(this.debugState) {
            //TODO: When the api for detach exists do something for this.
            this.snackBar.open("Killing and detaching not yet implemented.", undefined, {
                duration: 1000
            });
        }
    }
}
