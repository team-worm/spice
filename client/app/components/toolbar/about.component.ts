import {Component} from "@angular/core";
import {MdDialog} from "@angular/material";
import {HelpComponent} from "./help.component";

@Component({
    moduleId: module.id,
    selector: 'spice-help',
    templateUrl: './about.component.html'
})
export class AboutComponent {

    constructor(private dialog: MdDialog) {

    }

    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}
