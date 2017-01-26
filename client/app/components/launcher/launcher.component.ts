import {Component} from "@angular/core";
import { DebuggerHttpService } from "../../services/debugger-http.service";
import {ViewService} from "../../services/view.service";
import {SourceFile} from "../../models/SourceFile";
import {Process} from "../../models/Process";

@Component({
    selector: 'spice-launcher',
    templateUrl: 'app/components/launcher/launcher.component.html'
})
export class LauncherComponent {

    public selectedFile: SourceFile | undefined;
    public selectedProcess: Process | undefined;

    constructor(private debuggerHttpService: DebuggerHttpService,
                private viewService:ViewService) {

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

}
