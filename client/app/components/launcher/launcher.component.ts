import {Component} from "@angular/core";
import {FileSystemService} from "../../services/file.system.service";

@Component({
    selector: 'spice-launcher',
    template: `<div class="launcher"><h4>Select a binary to launch</h4><button md-raised-button>'binary-search.exe'</button></div>`
})
export class LauncherComponent {
    constructor(private fileSystemService:FileSystemService) {
        fileSystemService.exampleServiceMethod();
    }

}