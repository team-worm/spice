import {Component, Input, OnInit, ViewChild} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {StructTypeDisplay} from "./struct-type-display.component";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {ArrayTypeDisplay} from "./array-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";
@Component({
    selector: 'spice-pointer-type-display',
    template: `
        <div class="pointer" *ngIf="types && type" (click)="expanded = !expanded" [ngClass]="{'expanded':expanded}">
            {{type.toString(types)}}<md-icon>{{expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}}</md-icon>
        </div>
        <div class="pointer-contents" *ngIf="expanded && types && type" [ngSwitch]="types.get(type.data.sType).data.tType">
            <spice-struct-type-display
                    *ngSwitchCase="'struct'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primitive'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"></spice-primitive-type-display>
            <spice-array-type-display
                    *ngSwitchCase="'array'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-function-type-display>
        </div>
    `
})
export class PointerTypeDisplay {

    @Input()
    public type:SourceType;

    @Input()
    public value:Value;

    @Input()
    public editable:boolean;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    // @ViewChild(StructTypeDisplay)
    // private structDisplay: StructTypeDisplay;
    // @ViewChild(PrimitiveTypeDisplay)
    // private primitiveDisplay: PrimitiveTypeDisplay;
    // @ViewChild(ArrayTypeDisplay)
    // private arrayDisplay: ArrayTypeDisplay;
    // @ViewChild(PointerTypeDisplay)
    // private pointerDisplay: PointerTypeDisplay;
    // @ViewChild(FunctionTypeDisplay)
    // private functionDisplay: FunctionTypeDisplay;

    public expanded:boolean = false;

    public getValue():Value | undefined {
        return this.value ? this.value : {value: null};
    }

    constructor() {}
}