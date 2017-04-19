///<reference path="components/common/variable-display/variable-display.component.ts"/>
import 'hammerjs';
import './rxjs-extensions';

import {NgModule}      from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
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
import {VariableDisplayComponent} from "./components/common/variable-display/variable-display.component";

import { MatchMaxHeightDirective } from "./directives/MatchMaxHeight.directive";
import { ParameterFocusDirective } from "./directives/ParameterFocus.directive";
import { TraceComponent } from "./components/debugger/trace.component";
import { LineGraphComponent } from "./components/common/line-graph.component";
import { TraceLoopComponent } from "./components/debugger/trace-loop.component";
import {TraceHistoryComponent} from "./components/debugger/trace-history/trace-history.component";
import {StructTypeDisplay} from "./components/common/variable-display/struct-type-display.component";
import {PrimitiveTypeDisplay} from "./components/common/variable-display/primitive-type-display.component";
import {ArrayTypeDisplay} from "./components/common/variable-display/array-type-display.component";
import {PointerTypeDisplay} from "./components/common/variable-display/pointer-type-display.component";
import {FunctionTypeDisplay} from "./components/common/variable-display/function-type-display.component";
import {TypeMappingComponent} from "./components/common/type-mapping.component";

@NgModule({
    imports: [MaterialModule.forRoot(), FormsModule, RouterModule, BrowserModule, HttpModule, FlexLayoutModule, BrowserAnimationsModule],
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
        ProcessListComponent,
        FilterByStringPipe,
        MatchMaxHeightDirective,
        ParameterFocusDirective,
        LineGraphComponent,
        TraceHistoryComponent,
        VariableDisplayComponent,
        StructTypeDisplay,
        PrimitiveTypeDisplay,
        ArrayTypeDisplay,
        PointerTypeDisplay,
        FunctionTypeDisplay,
        TypeMappingComponent
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
        HelpComponent,
        TypeMappingComponent],
    bootstrap: [SpiceRootComponent]

})
export class SpiceModule {
    constructor(mdIconRegistry: MdIconRegistry) {

    }
}
