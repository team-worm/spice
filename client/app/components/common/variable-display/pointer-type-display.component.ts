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
        <span   *ngIf="types && type" (click)="expanded = !expanded"
                class="pointer"  
                title="{{expanded ? 'Hide pointer contents.' : 'Show pointer contents.'}}"
                [ngClass]="{'expanded':expanded}">
            {{type.toString(types)}}<md-icon>{{expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}}</md-icon>
        </span>
        <div class="pointer-contents" *ngIf="expanded && types && type" [ngSwitch]="types.get(type.data.sType).data.tType">
            <spice-struct-type-display
                    #struct
                    *ngSwitchCase="'struct'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primitive'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [compact]="compact && !editable"></spice-primitive-type-display>
            <spice-array-type-display
                    #array
                    *ngSwitchCase="'array'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="types.get(type.data.sType)"
                    [value]="value"
                    [editable]="editable"
                    [compact]="compact && !editable"
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
    public valueMap:{ [sVariable: number]: Value};

    @Input()
    public editable:boolean = false;

    @Input()
    public compact:boolean = false;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    @ViewChild('struct')
    private structDisplay: StructTypeDisplay;
    @ViewChild(PrimitiveTypeDisplay)
    private primitiveDisplay: PrimitiveTypeDisplay;
    @ViewChild('array')
    private arrayDisplay: ArrayTypeDisplay;
    @ViewChild(PointerTypeDisplay)
    private pointerDisplay: PointerTypeDisplay;
    @ViewChild(FunctionTypeDisplay)
    private functionDisplay: FunctionTypeDisplay;

    public expanded:boolean = false;

    public getValue():Value | undefined {
        if(this.type && this.types && this.type.data.tType === 'pointer') {
            let targetType = this.types.get(this.type.data.sType)!;

            switch(targetType.data.tType) {
                case "primitive":
                    if(this.primitiveDisplay)
                        return this.primitiveDisplay.getValue();
                    break;
                case "pointer":
                    if(this.pointerDisplay)
                        return this.pointerDisplay.getValue();
                    break;
                case "array":
                    if(this.arrayDisplay)
                        return this.arrayDisplay.getValue();
                    break;
                case "struct":
                    if(this.structDisplay)
                        return this.structDisplay.getValue();
                    break;
                case "function":
                    if(this.functionDisplay)
                        return this.functionDisplay.getValue();
                    break;
            }
        }
    }

    constructor() {}
}