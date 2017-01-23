import {Component} from "@angular/core";
import { DebuggerHttpService } from "../../services/debugger-http.service";
import {ViewService} from "../../services/view.service";
import {SourceFile} from "../../models/SourceFile";

@Component({
    selector: 'spice-launcher',
    templateUrl: 'app/components/launcher/launcher.component.html'
})
export class LauncherComponent {

    public selectedFile: SourceFile | undefined;

    constructor(private debuggerHttpService: DebuggerHttpService,
                private viewService:ViewService) {

        this.selectedFile = undefined;

		//TODO: remove these test functions
		//debuggerHttpService.getFunctions('0').subscribe(function(sfs) { console.log(sfs);});
		//debuggerHttpService.executeBinary('', '', '').subscribe(function(execution) { console.log(execution); });
    }

    public FileSelected($event:SourceFile) {
        this.selectedFile = $event;
    }

    public SelectedFileName():string {
        if(this.selectedFile) {
            return this.selectedFile.name;
        } else {
            return '...'
        }
    }


}
