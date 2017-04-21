import {AfterContentChecked, Component, ElementRef, ViewChild} from "@angular/core";
import {Response} from "@angular/http";
import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";
import {AttachEvent, DebuggerService, DetachEvent} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {FileBrowserComponent} from "../common/file-browser.component";
import {ProcessListComponent} from "../common/process-list.component";

 /**
 * Launcher Component
 * Large component that contains all the sub-components responsible for launching and attaching to applications and processes.
 * Contains the File Browser Component and Process List Component which reports back user selections.
 * Informs the Debugger Service that the user has made a selection and they wish to attach to it.
 *
 */

@Component({
    moduleId: module.id,
    selector: 'spice-launcher',
    templateUrl: './launcher.component.html'
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
    public launchedFile: SourceFile | null = null;

	constructor(private debuggerService: DebuggerService,
				private element: ElementRef) {
		this.debuggerService.getEventStream(['attach']).subscribe((event: AttachEvent) => this.onAttach(event));
		this.debuggerService.getEventStream(['detach']).subscribe((event: DetachEvent) => this.onDetach(event));
	}

    public ngAfterContentChecked() {
        this.launcherCardHeight = (window.innerHeight - this.element.nativeElement.getBoundingClientRect().top) - 34;
        this.fileBrowserHeight = (window.innerHeight - this.fileBrowser.element.nativeElement.getBoundingClientRect().top) - 93;
        this.processListHeight = (window.innerHeight - this.processList.element.nativeElement.getBoundingClientRect().top) - 93;
    }

    public GetSelectedName():string {
        if(this.selectedFileOrProcess) {
            return this.selectedFileOrProcess.name;
        }
        return '';
    }
    public GetSelectedIcon():string {
        if(this.selectedFileOrProcess !== null) {
            if((<Process> this.selectedFileOrProcess).id) {
                return "settings_application";
            } else if ((<SourceFile> this.selectedFileOrProcess).data) {
                return "insert_drive_file"
            }
        }
        return "touch_app";
    }
    public GetLaunchAttachButtonText():string {
        if(this.selectedFileOrProcess !== null) {
            if((<Process> this.selectedFileOrProcess).id) {
                return "Attach to Process";
            } else if ((<SourceFile> this.selectedFileOrProcess).data) {
                return "Launch Binary"
            }
            /* Consider adding something specific for selected file vs null*/
        }
        return "Select Target";
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

    public OnFileSelected($event:SourceFile | null) {
        this.selectedFileOrProcess = $event;
        this.processList.ResetSelectedProcess();
    }
    public OnDoubleClickFile($event: SourceFile) {
        this.selectedFileOrProcess = $event;
        this.processList.ResetSelectedProcess();
        this.Attach();
    }
    public OnProcessSelected($event:Process | null) {
        this.selectedFileOrProcess = $event;
        this.fileBrowser.ResetSelectedFile();
    }

	public Attach() {
		if(this.selectedFileOrProcess) {
			this.attaching = true;
			if(this.selectedFileOrProcess instanceof Process) {
				this.attachToProcess(this.selectedFileOrProcess);
			} else {
				this.launchBinary(this.selectedFileOrProcess);
			}
		}
	}

	private launchBinary(f:SourceFile) {
		this.launchedFile = f;
		this.debuggerService.attachBinary(f.path, f.name).subscribe(
			(ds: DebuggerState) => {},
				(error: Response) => { this.onAttachError(error, f.name); });
	}

	private attachToProcess(p:Process) {
		this.debuggerService.attachProcess(p.id, p.name).subscribe(
			(ds: DebuggerState) => {},
				(error: Response) => { this.onAttachError(error, p.name); });
	}

	protected onAttachError(error: any, attachName: string) {
		this.attaching = false;
	}

	public onAttach(event: AttachEvent) {
		this.attaching = false;
	}

	public onDetach(event: DetachEvent) {
		this.debugProcessName = '';
		this.launchedFile = null;
		setTimeout(()=> {
            this.launcherCardHeight = (window.innerHeight - this.element.nativeElement.getBoundingClientRect().top) - 34;
            this.fileBrowserHeight = (window.innerHeight - this.fileBrowser.element.nativeElement.getBoundingClientRect().top) - 93;
            this.processListHeight = (window.innerHeight - this.processList.element.nativeElement.getBoundingClientRect().top) - 93;
        }, 1);
	}
}
