import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-array-type-display',
    template: `        
        <div>Array of {{types[type.sType].base}} [{{type.count}}]</div>
    `
})
export class ArrayTypeDisplay {
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