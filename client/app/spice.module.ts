import 'hammerjs';
import './rxjs-extensions';

import {NgModule}      from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {MaterialModule, MdIconRegistry} from "@angular/material";
import {FormsModule} from "@angular/forms";
import { HttpModule } from "@angular/http";

import {SpiceRootComponent} from "./components/spice-root.component";
import {ToolbarComponent} from "./components/toolbar/toolbar.component";
import {AboutComponent} from "./components/toolbar/about.component";
import {HelpComponent} from "./components/toolbar/help.component";
import {LauncherComponent} from "./components/launcher/launcher.component";
import {ConfigurationComponent} from "./components/configuration/configuration.component";
import {DebuggerComponent} from "./components/debugger/debugger.component";

import {FileSystemService} from "./services/file-system.service";
import {ViewService} from "./services/view.service";
import { DebuggerService } from "./services/debugger.service";
import { DebuggerHttpService } from "./services/debugger-http.service";

@NgModule({
    imports: [MaterialModule.forRoot(), FormsModule, BrowserModule, HttpModule],
    declarations: [AboutComponent, HelpComponent, SpiceRootComponent, ToolbarComponent,LauncherComponent,ConfigurationComponent,DebuggerComponent],
    providers: [ FileSystemService, ViewService, DebuggerHttpService, DebuggerService ],
    entryComponents: [AboutComponent, HelpComponent],
    bootstrap: [SpiceRootComponent]

})
export class SpiceModule {
    constructor(mdIconRegistry: MdIconRegistry) {

        mdIconRegistry.registerFontClassAlias('fontawesome','fa');
        mdIconRegistry.setDefaultFontSetClass('fa');

    }
}
