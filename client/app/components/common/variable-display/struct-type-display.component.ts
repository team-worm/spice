import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-struct-type-display',
    template: `
        <div class="struct">
            <div class="variable-header">
                <span class="variable-subname">{{type.name}}: <i>struct</i></span>
            </div>
            <hr>
            <span *ngFor="let f of type.fields" [ngSwitch]="types[f.sType].tType">
                <spice-struct-type-display *ngSwitchCase="'struct'"></spice-struct-type-display>
                <spice-primitive-type-display *ngSwitchCase="'primitive'"></spice-primitive-type-display>
            </span>
        </div>
    `
})
export class StructTypeDisplay implements OnInit{
    @Input()
    public variable:any;

    @Input()
    public type:any;

    @Input()
    public value:any;

    @Input()
    public editable:boolean;

    /* Delete Mes */
    public types: {[id: number]: any};
    /* END Delete Mes*/

    constructor(){


        this.types = {
            1: {
                tType:"struct",
                name:"ThreeInts",
                size:12,
                fields: [
                    {
                        name:"First",
                        sType:2,
                        offset:0
                    },
                    {
                        name:"Second",
                        sType:2,
                        offset:4
                    },
                    {
                        name:"Third",
                        sType:2,
                        offset:8
                    }
                ]
            },
            2: {
                tType:"primitive",
                base:"int",
                size:4
            }
        };

        this.type = this.types[1];
    }

    public ngOnInit() {
        console.log(this.type)
        //TODO Type Validation
    }

}