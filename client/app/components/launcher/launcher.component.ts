import {Component} from "@angular/core";
import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";
import {DebuggerService} from "../../services/debugger.service";
import {MdSnackBar} from "@angular/material";

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

		//TODO: remove these test functions
		//debuggerHttpService.getFunctions('0').subscribe(function(sfs) { console.log(sfs);});
		//debuggerHttpService.executeBinary('', '', '').subscribe(function(execution) { console.log(execution); });
    }

    public OnFileSelected($event:SourceFile) {
        this.selectedFile = $event;
    }
    public OnProcessSelected($event:Process) {
        this.selectedProcess = $event;
    }

    public LaunchBinary() {

    }
    public AttachToProcess() {

    }
}
