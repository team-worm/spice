import {NgModule} from "@angular/core";
import {MaterialModule} from "@angular/material";

import {SpiceRootComponent} from "./spice.root.component";
import {ToolbarComponent} from "./toolbar/toolbar.component";
import {AboutComponent} from "./toolbar/about.component";
import {HelpComponent} from "./toolbar/help.component";
import {LauncherComponent} from "./launcher/launcher.component";

@NgModule({
    imports: [MaterialModule],
    declarations: [AboutComponent, HelpComponent, SpiceRootComponent, ToolbarComponent,LauncherComponent],
    entryComponents: [AboutComponent, HelpComponent],
    exports: [SpiceRootComponent],
})
export class ComponentsModule {}