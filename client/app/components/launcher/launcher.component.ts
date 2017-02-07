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

    public LaunchBinary() {
        if (this.selectedFile) {
            this.attaching = true;

            let self = this;
            let launchedFile = this.selectedFile;
            this.debuggerService.attachBinary(this.selectedFile.path).subscribe({
                next: (ds: DebuggerState) => {
                    self.debuggerService.setCurrentDebuggerState(ds);
                    self.debugState = ds;
                    self.debugStateFile = launchedFile;
                    self.attaching = false;
                    if (self.viewService.functionsComponent) {
                        self.viewService.functionsComponent.loadSourceFunctions();
                    }
                    if (self.viewService.toolbarComponent) {
                        self.viewService.toolbarComponent.debugState = ds;
                        self.viewService.toolbarComponent.debugStateFile = launchedFile;
                    }
                    if (self.viewService.debuggerComponent) {
                        self.viewService.debuggerComponent.debugState = ds;
                    }
                    self.viewService.activeView = 'functions';
                },
                complete: () => {
                },
                error: (error: Response) => {
                    self.attaching = false;
                    self.snackBar.open('Error Launching ' + launchedFile.name + ' (' + error.status + '): ' + error.statusText, undefined, {
                        duration: 3000
                    });
                    if ((<any>error).message) {
                        console.error(error);
                    }
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
