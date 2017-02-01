import {Component} from "@angular/core";
import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";
import {DebuggerService} from "../../services/debugger.service";
import {MdSnackBar} from "@angular/material";
import {DebuggerState} from "../../models/DebuggerState";
import {Response} from "@angular/http";

@Component({
    selector: 'spice-launcher',
    templateUrl: 'app/components/launcher/launcher.component.html'
})
export class LauncherComponent {

    public selectedFile: SourceFile | undefined;
    public selectedProcess: Process | undefined;

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar) {

        this.selectedFile = undefined;

    }

    public OnFileSelected($event:SourceFile) {
        this.selectedFile = $event;
    }
    public OnProcessSelected($event:Process) {
        this.selectedProcess = $event;
    }

    public LaunchBinary() {
        if(this.selectedFile) {
            let self = this;
            let launchedFile = this.selectedFile;
            this.debuggerService.attachBinary(this.selectedFile.path).subscribe({
                next: (ds:DebuggerState)=>{console.log(ds)},
                complete: ()=>{},
                error: (error:Response)=>{
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
}
