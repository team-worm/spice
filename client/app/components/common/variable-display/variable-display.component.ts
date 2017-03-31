import {Component, Input} from "@angular/core";

@Component({
    selector: 'spice-variable-display',
    template: `
        <form class="variable-display">
            <div [ngSwitch]="getType().tType">
                <spice-struct-type-display
                        *ngSwitchCase="'struct'"
                        [variable]="variable"
                        [type]="getType()"
                        [value]="value"
                        [editable]="editable"
                        [types]="types"></spice-struct-type-display>
                <spice-primitive-type-display
                        *ngSwitchCase="'primative'"
                        [variable]="variable"
                        [type]="getType()"
                        [value]="value"
                        [editable]="editable"></spice-primitive-type-display>
                <spice-array-type-display
                        *ngSwitchCase="'array'"
                        [variable]="variable"
                        [type]="getType()"
                        [value]="value"
                        [editable]="editable"
                        [types]="types"></spice-array-type-display>
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

    public displayedVariables:{[name: string]:boolean};

    /* Delete Mes */
    public types: {[id: number]: any};
    /* END Delete Mes*/

    constructor(){
        this.editable = true;

        this.types = {
            1: {
                tType:"struct",
                name:"StuffStruct",
                size:12,
                fields: [
                {
                    name:"VoidVar",
                    sType:2,
                    offset:0
                },
                {
                    name:"BoolVar",
                    sType:3,
                    offset:4
                },
                {
                    name:"Int32Var",
                    sType:4,
                    offset:8
                },
                {
                    name:"UInt32Var",
                    sType:5,
                    offset:8
                },
                {
                    name:"FloatVar",
                    sType:6,
                    offset:8
                },
                {
                    name:"ArrayO'Nums",
                    sType:7,
                    offset:0
                }
            ]
            },
            2: {
                tType:"primitive",
                base:"void",
                size:4
            },
            3: {
                tType:"primitive",
                base:"bool",
                size:4
            },
            4: {
                tType:"primitive",
                base:"int",
                size:4
            },
            5: {
                tType:"primitive",
                base:"uint",
                size:4
            },
            6: {
                tType:"primitive",
                base:"float",
                size:4
            },
            7: {
                tType:"array",
                sType:4,
                count:10
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