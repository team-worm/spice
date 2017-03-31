import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-function-type-display',
    template: `
        <div>Function</div>
    `
})
export class FunctionTypeDisplay {
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