import {Component, Input} from "@angular/core";

@Component({
    selector: 'spice-variable-display',
    template: `
        <form class="variable-display">
            <div class="variable-header">
                <span class="variable-name">{{variable.name}}</span>
                <!--<button class="save-button" md-button>Save</button>-->
            </div>
            <div [ngSwitch]="getType().tType">
                <spice-struct-type-display *ngSwitchCase="'struct'"></spice-struct-type-display>
                <spice-primitive-type-display *ngSwitchCase="'primative'"></spice-primitive-type-display>
            </div>
            
        </form>
    `
})
export class VariableDisplayComponent {

    @Input()
    public variable:any;

    @Input()
    public value:any;

    @Input()
    public editable:boolean;

    /* Delete Mes */
    public types: {[id: number]: any};
    /* END Delete Mes*/

    constructor(){
        this.editable = true;

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

        this.variable = {
            name: "myVar",
            sType: 1,
            address: 1
        }
    }

    public getType():any {
        return this.types[this.variable.sType];
    }
}