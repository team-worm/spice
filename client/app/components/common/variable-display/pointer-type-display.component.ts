import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-pointer-type-display',
    template: `
        <div>Pointer to {{types[type.sType].base}}</div>
    `
})
export class PointerTypeDisplay {
    @Input()
    public variable:any;

    @Input()
    public type:any;

    @Input()
    public value:any;

    @Input()
    public editable:boolean;

    /* Delete Mes */
    @Input()
    public types: {[id: number]: any};
    /* END Delete Mes*/

    constructor() {}
}