import {NgModule} from "@angular/core";
import {MaterialModule} from "@angular/material";

import {SpiceRootComponent} from "./spice.root.component";
import {ToolbarComponent} from "./toolbar/toolbar.component";

@NgModule({
    imports: [MaterialModule],
    declarations: [SpiceRootComponent, ToolbarComponent],
    exports: [SpiceRootComponent],
})
export class ComponentsModule {}