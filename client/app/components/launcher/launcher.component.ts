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
    public debugProcessName: string;
    public attaching:boolean;

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar,
                private viewService: ViewService) {

        this.selectedFile = null;
        this.selectedProcess = null;
        this.debugState = null;
        this.debugProcessName = '';
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
            this.debuggerService.attachBinary(this.selectedFile.path).subscribe(
            	(ds: DebuggerState) => { this.onAttach(ds, launchedFile.name); },
                (error: Response) => {
                    this.attaching = false;
                    this.snackBar.open('Error Launching ' + launchedFile.name + ' (' + error.status + '): ' + error.statusText, undefined, {
                        duration: 3000
                    });
                    if ((<any>error).message) {
                        console.error(error);
                    }
                });
        } else {
            this.snackBar.open("No valid file selected to launch.", undefined, {
                duration: 3000
            });
        }

    }

    public AttachToProcess() {
		if (this.selectedProcess) {
			this.attaching = true;

			let attachedProcess = this.selectedProcess;
			this.debuggerService.attachProcess(attachedProcess.id).subscribe(
				(ds: DebuggerState) => { this.onAttach(ds, attachedProcess.name); },
					(error: Response) => {
					this.attaching = false;
					this.snackBar.open('Error Attaching ' + attachedProcess.name  + ' (' + error.status + '): ' + error.statusText, undefined, {
						duration: 3000
					});
					if ((<any>error).message) {
						console.error(error);
					}
				});
	} else {
		this.snackBar.open("No valid process selected to attach.", undefined, {
			duration: 3000
		});
	}

	}

	public onAttach(ds: DebuggerState, processName: string) {
		this.debuggerService.setCurrentDebuggerState(ds);
		this.debugState = ds;
		this.debugProcessName = processName;
		this.attaching = false;
		if (this.viewService.functionsComponent) {
			this.viewService.functionsComponent.loadSourceFunctions();
		}
		if (this.viewService.toolbarComponent) {
			this.viewService.toolbarComponent.debugState = ds;
			this.viewService.toolbarComponent.debugProcessName = processName;
		}
		if (this.viewService.debuggerComponent) {
			this.viewService.debuggerComponent.debugState = ds;
		}
		this.viewService.activeView = 'functions';
	}
}
