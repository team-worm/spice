import {Component} from "@angular/core";
import {MdDialog} from "@angular/material";
import {AboutComponent} from "./about.component";
import {HelpComponent} from "./help.component";

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    constructor(public dialog: MdDialog) {
    }

    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}