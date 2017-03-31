import {Component, Input} from "@angular/core";
@Component({
    selector: 'spice-struct-type-display',
    template: `
        <div class="struct">
            <div class="variable-header">
                <span class="variable-name">{{variable.name}}</span>:
                <span class="variable-subname">{{type.name}}</span>
            </div>
            <table>
                <tr *ngFor="let f of type.fields" [ngSwitch]="types[f.sType].tType">
                    <td>{{f.name}}</td>
                    <td>
                        <spice-struct-type-display
                                *ngSwitchCase="'struct'"
                                [types]="types"></spice-struct-type-display>
                        <spice-primitive-type-display
                                *ngSwitchCase="'primitive'"
                                [variable]="f"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"></spice-primitive-type-display>
                        <spice-array-type-display
                                *ngSwitchCase="'array'"
                                [variable]="variable"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-array-type-display>
                    </td>
                </tr>
            </table>
        </div>
    `
})
export class StructTypeDisplay{
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

    constructor(){
    }

}