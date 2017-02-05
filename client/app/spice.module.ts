import 'hammerjs';
import './rxjs-extensions';

import {NgModule}      from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {MaterialModule, MdIconRegistry} from "@angular/material";
import {FormsModule} from "@angular/forms";
import {HttpModule} from "@angular/http";
import {RouterModule} from "@angular/router";
import {FlexLayoutModule} from "@angular/flex-layout";

import {SpiceRootComponent} from "./components/spice-root.component";
import {ToolbarComponent} from "./components/toolbar/toolbar.component";
import {AboutComponent} from "./components/toolbar/about.component";
import {HelpComponent} from "./components/toolbar/help.component";
import {LauncherComponent} from "./components/launcher/launcher.component";
import {ConfigurationComponent} from "./components/configuration/configuration.component";
import {DebuggerComponent} from "./components/debugger/debugger.component";

import {FileSystemService} from "./services/file-system.service";
import {ViewService} from "./services/view.service";
import {DebuggerService} from "./services/debugger.service";
import {DebuggerHttpService} from "./services/debugger-http.service";
import {FileBrowserComponent} from "./components/common/file-browser.component";
import {FileBrowserNodeComponent} from "./components/common/file-browser-node.component";
import {FunctionListComponent} from "./components/common/function-list.component";
import {ProcessListComponent} from "./components/common/process-list.component";
import {FilterByStringPipe} from "./pipes/filter-by-string.pipe";

import { MockBackend } from "@angular/http/testing";
import { Http, BaseRequestOptions, RequestOptions, ConnectionBackend } from "@angular/http";
import { SpiceMockBackend } from "./spice-mock-backend";
import { XHRBackend } from "@angular/http";

@NgModule({
    imports: [MaterialModule.forRoot(), FormsModule, RouterModule, BrowserModule, HttpModule, FlexLayoutModule],
    declarations: [
        AboutComponent,
        HelpComponent,
        SpiceRootComponent,
        ToolbarComponent,
        LauncherComponent,
        ConfigurationComponent,
        DebuggerComponent,
        FileBrowserComponent,
        FileBrowserNodeComponent,
        FunctionListComponent,
        ProcessListComponent,
        FilterByStringPipe
    ],
    providers: [
        //BEGIN MOCK PROVIDERS--Comment these out to disable backend mocking!
		 // MockBackend,
		 // BaseRequestOptions,
		 // SpiceMockBackend,
        //END MOCK PROVIDERS
        
        FileSystemService,
        ViewService,
        DebuggerHttpService,
        DebuggerService],
    entryComponents: [
        AboutComponent,
        HelpComponent],
    bootstrap: [SpiceRootComponent]

})
export class SpiceModule {
    constructor(mdIconRegistry: MdIconRegistry) {

    }
}
