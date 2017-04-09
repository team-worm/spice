import {Component, Input} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
@Component({
    selector: 'spice-struct-type-display',
    template: `
        <div class="struct">
            <div class="variable-header">
                <span class="variable-subname">{{type.data.tType == 'struct' ? type.data.name : 'Type Error'}}</span>
            </div>
            <table>
                <tr *ngFor="let f of type.data.fields" [ngSwitch]="types.get(f.sType).data.tType">
                    <td>
                        <div class="fieldName">{{f.name}}</div>
                        <div class="fieldType">{{types.get(f.sType).toString(types)}}</div>
                    </td>
                    <td>
                        <spice-struct-type-display
                                *ngSwitchCase="'struct'"
                                [type]="types.get(f.sType)"
                                [types]="types"
                                [editable]="editable"></spice-struct-type-display>
                        <spice-primitive-type-display
                                *ngSwitchCase="'primitive'"
                                [type]="types.get(f.sType)"
                                [value]="value"
                                [editable]="editable"></spice-primitive-type-display>
                        <spice-array-type-display
                                *ngSwitchCase="'array'"
                                [type]="types.get(f.sType)"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-array-type-display>
                        <spice-pointer-type-display
                                *ngSwitchCase="'pointer'"
                                [type]="types.get(f.sType)"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-pointer-type-display>
                        <spice-function-type-display
                                *ngSwitchCase="'function'"
                                [type]="types.get(f.sType)"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-function-type-display>
                    </td>
                </tr>
            </table>
        </div>
    `
})
export class StructTypeDisplay{

    @Input()
    public type:SourceType;

    @Input()
    public value:any;

    @Input()
    public editable:boolean;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    constructor(){}
}