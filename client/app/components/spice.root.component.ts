import {Component} from '@angular/core';
import {ViewService} from "../services/view.service";

@Component({
    selector: 'spice-root',
    template: `
<spice-toolbar></spice-toolbar>
<spice-launcher [hidden]="!IsInLauncher()"></spice-launcher>
<spice-configuration [hidden]="!IsInConfiguration()"></spice-configuration>
<spice-debugger [hidden]="!IsInDebugger()"></spice-debugger>
`,
})
export class SpiceRootComponent {
    constructor(private viewService:ViewService) {}

    public IsInLauncher():boolean {
        return this.viewService.activeView == 'launcher';
    }

    public IsInConfiguration():boolean {
        return this.viewService.activeView == 'configuration';
    }

    public IsInDebugger():boolean {
        return this.viewService.activeView == 'debugger';
    }
}
