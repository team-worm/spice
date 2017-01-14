import {Component} from '@angular/core';

@Component({
    selector: 'spice-root',
    template:
        `<spice-toolbar></spice-toolbar>`,
})
export class SpiceRootComponent {
    name = 'Angular';

    constructor() {
        this.name = 'sam';
    }
}
