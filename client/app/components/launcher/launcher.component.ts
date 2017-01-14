import {Component} from "@angular/core";
import {FileSystemService} from "../../services/file.system.service";

@Component({
    selector: 'spice-launcher',
    template: `Launch spicy stuff here...`
})
export class LauncherComponent {
    constructor(private fileSystemService:FileSystemService) {
        fileSystemService.exampleServiceMethod();
    }

}