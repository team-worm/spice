import {NgModule} from "@angular/core";
import {MaterialModule} from "@angular/material";

import {SpiceRootComponent} from "./spice.root.component";
import {ToolbarComponent} from "./toolbar/toolbar.component";
import {AboutComponent} from "./toolbar/about.component";
import {HelpComponent} from "./toolbar/help.component";
import {LauncherComponent} from "./launcher/launcher.component";
import {ConfigurationComponent} from "./configuration/configuration.component";
import {DebuggerComponent} from "./debugger/debugger.component";
import {FormsModule} from "@angular/forms";

@NgModule({
    imports: [MaterialModule, FormsModule],
    declarations: [AboutComponent, HelpComponent, SpiceRootComponent, ToolbarComponent,LauncherComponent,ConfigurationComponent,DebuggerComponent],
    entryComponents: [AboutComponent, HelpComponent],
    exports: [SpiceRootComponent],
})
export class ComponentsModule {}