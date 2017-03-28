///<reference path="components/common/type-display.component.ts"/>
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
import {FunctionsComponent} from "./components/functions/functions.component";
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
import {TypeDisplayComponent} from "./components/common/type-display.component";

import { MockBackend } from "@angular/http/testing";
import { Http, BaseRequestOptions, RequestOptions, ConnectionBackend } from "@angular/http";
import { SpiceMockBackend } from "./spice-mock-backend";
import { XHRBackend } from "@angular/http";
import { MatchMaxHeightDirective } from "./directives/MatchMaxHeight.directive";
import { TraceComponent } from "./components/debugger/trace.component";
import { LineGraphComponent } from "./components/common/line-graph.component";
import { TraceLoopComponent } from "./components/debugger/trace-loop.component";
import {TraceHistoryComponent} from "./components/debugger/trace-history/trace-history.component";

@NgModule({
    imports: [MaterialModule.forRoot(), FormsModule, RouterModule, BrowserModule, HttpModule, FlexLayoutModule],
    declarations: [
        AboutComponent,
        HelpComponent,
        SpiceRootComponent,
        ToolbarComponent,
        LauncherComponent,
        FunctionsComponent,
        DebuggerComponent,
        TraceComponent,
        TraceLoopComponent,
        FileBrowserComponent,
        FileBrowserNodeComponent,
        FunctionListComponent,
        TypeDisplayComponent,
        ProcessListComponent,
        FilterByStringPipe,
        MatchMaxHeightDirective,
        LineGraphComponent,
        TraceHistoryComponent
    ],
    providers: [
        //BEGIN MOCK PROVIDERS--Comment these out to disable backend mocking!
		 //  MockBackend,
		 //  BaseRequestOptions,
		 //  SpiceMockBackend,
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
