import {Component} from "@angular/core";
import {MdDialog} from "@angular/material";
import {HelpComponent} from "./help.component";
import {ViewService} from "../../services/view.service";

/**
 * About Component
 * Displays some simple information about Spice and Team Worm.
 * Contains link to the help view.
 */

@Component({
    moduleId: module.id,
    selector: 'spice-help',
    templateUrl: './about.component.html'
})
export class AboutComponent {

    constructor(private viewservice:ViewService,
                private dialog: MdDialog) {

    }

    public openHelpDialog() {
        this.dialog.open(HelpComponent);
    }
    public SetTheme(theme:string) {
        if(this.viewservice.rootComponent) {
            this.viewservice.rootComponent.SetTheme(theme);
        }
    }
}
