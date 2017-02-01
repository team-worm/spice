import {Component} from "@angular/core";
import {MdDialog} from "@angular/material";
import {AboutComponent} from "./about.component";
import {HelpComponent} from "./help.component";
import {ViewService} from "../../services/view.service";

@Component({
    selector: 'spice-toolbar',
    templateUrl: 'app/components/toolbar/toolbar.component.html'
})
export class ToolbarComponent {

    selectedView:string;

    constructor(public dialog: MdDialog, public viewService:ViewService) {
        this.selectedView = 'launcher';
    }

    openAboutSpiceDialog() {
        this.dialog.open(AboutComponent);
    }
    openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
}