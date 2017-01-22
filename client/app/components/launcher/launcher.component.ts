import {Component} from "@angular/core";
import {FileSystemService} from "../../services/file-system.service";
import { DebuggerHttpService } from "../../services/debugger-http.service";

@Component({
    selector: 'spice-launcher',
    template: `<div class="launcher"><h4>Select a binary to launch</h4><button md-raised-button>'binary-search.exe'</button></div>`
})
export class LauncherComponent {
    constructor(private fileSystemService:FileSystemService, private debuggerHttpService: DebuggerHttpService) {
        fileSystemService.exampleServiceMethod();

		//TODO: remove these test functions
		//debuggerHttpService.getFunctions('0').subscribe(function(sfs) { console.log(sfs);});
		//debuggerHttpService.executeBinary('', '', '').subscribe(function(execution) { console.log(execution); });
    }

}
