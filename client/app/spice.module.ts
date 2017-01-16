import 'hammerjs';
import {NgModule}      from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {ComponentsModule} from "./components/components.module";
import {SpiceRootComponent} from "./components/spice.root.component";
import {MaterialModule, MdIconRegistry} from "@angular/material";
import {ServiceModule} from "./services/service.module";

@NgModule({
    imports: [MaterialModule.forRoot(), BrowserModule, ComponentsModule, ServiceModule],
    bootstrap: [SpiceRootComponent]

})
export class SpiceModule {
    constructor(mdIconRegistry: MdIconRegistry) {
        mdIconRegistry.registerFontClassAlias('fontawesome','fa');
        mdIconRegistry.setDefaultFontSetClass('fa');


    }
}
