import 'hammerjs';
import {NgModule}      from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {ComponentsModule} from "./components/components.module";
import {SpiceRootComponent} from "./components/spice.root.component";

@NgModule({
    imports: [BrowserModule, ComponentsModule],
    bootstrap: [SpiceRootComponent]

})
export class SpiceModule {
}
