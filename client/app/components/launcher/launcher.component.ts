import { Component, ViewChild, ElementRef, AfterContentChecked} from "@angular/core";
import {MdSnackBar} from "@angular/material";
import {Response} from "@angular/http";

import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {ViewService} from "../../services/view.service";
import {FileBrowserComponent} from "../common/file-browser.component";
import {ProcessListComponent} from "../common/process-list.component";

@Component({
    selector: 'spice-launcher',
    templateUrl: 'app/components/launcher/launcher.component.html'
})
export class LauncherComponent implements AfterContentChecked {

    @ViewChild('LauncherFileBrowser') fileBrowser:FileBrowserComponent;
    @ViewChild('LauncherProcessList') processList:ProcessListComponent;
    public launcherCardHeight:number = 0;
    public fileBrowserHeight:number = 0;
    public processListHeight:number = 0;

    public selectedFileOrProcess: SourceFile | Process | null = null;
    public debugState:DebuggerState | null = null;
    public debugProcessName: string = '';
    public attaching:boolean = false;

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar,
                private viewService: ViewService,
                private element: ElementRef) {}

    public ngAfterContentChecked() {
        this.launcherCardHeight = (window.innerHeight - this.element.nativeElement.getBoundingClientRect().top) - 86;
        this.fileBrowserHeight = (window.innerHeight - this.fileBrowser.element.nativeElement.getBoundingClientRect().top) - 58;
        this.processListHeight = (window.innerHeight - this.processList.element.nativeElement.getBoundingClientRect().top) - 58;
    }

    public GetSelectedName():string {
        if(this.selectedFileOrProcess) {
            return this.selectedFileOrProcess.name;
        } else {
            return 'Nothing Selected';
        }
    }
    public GetSelectedInformation():string {
        if(this.selectedFileOrProcess) {
            if(this.selectedFileOrProcess instanceof Process) {
                return this.selectedFileOrProcess.id.toString();
            } else {
                //console.log('p', this.selectedFileOrProcess);
                return this.selectedFileOrProcess.path;
            }
        } else {
            return '';
        }
    }

    public OnFileSelected($event:SourceFile) {
        this.selectedFileOrProcess = $event;
    }
    public OnProcessSelected($event:Process) {
        this.selectedFileOrProcess = $event;
    }

    public Attach() {
        if(this.selectedFileOrProcess) {
            if(this.selectedFileOrProcess instanceof Process) {
                this.attachToProcess(this.selectedFileOrProcess);
            } else {
                this.launchBinary(this.selectedFileOrProcess);
            }
        }
    }

    private launchBinary(f:SourceFile) {
        this.attaching = true;

        let launchedFile = f;
        this.debuggerService.attachBinary(f.path).subscribe(
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
    }

    private attachToProcess(p:Process) {

        this.attaching = true;
        let attachedProcess = p;

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
            }
        );

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
