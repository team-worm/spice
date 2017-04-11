import {Component, Input, OnInit, ViewChild} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {ArrayTypeDisplay} from "./array-type-display.component";
import {PointerTypeDisplay} from "./pointer-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";
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
                                [value]="value[f.offset]"
                                [editable]="editable"></spice-struct-type-display>
                        <spice-primitive-type-display
                                *ngSwitchCase="'primitive'"
                                [type]="types.get(f.sType)"
                                [value]="value[f.offset]"
                                [editable]="editable"></spice-primitive-type-display>
                        <spice-array-type-display
                                *ngSwitchCase="'array'"
                                [type]="types.get(f.sType)"
                                [value]="value[f.offset]"
                                [editable]="editable"
                                [types]="types"></spice-array-type-display>
                        <spice-pointer-type-display
                                *ngSwitchCase="'pointer'"
                                [type]="types.get(f.sType)"
                                [value]="value[f.offset]"
                                [editable]="editable"
                                [types]="types"></spice-pointer-type-display>
                        <spice-function-type-display
                                *ngSwitchCase="'function'"
                                [type]="types.get(f.sType)"
                                [value]="value[f.offset]"
                                [editable]="editable"
                                [types]="types"></spice-function-type-display>
                    </td>
                </tr>
            </table>
        </div>
    `
})
export class StructTypeDisplay implements OnInit{

    @Input()
    public type:SourceType;

    @Input()
    public value:Value;

    @Input()
    public editable:boolean;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    @ViewChild(StructTypeDisplay)
    private structDisplay: StructTypeDisplay;
    @ViewChild(PrimitiveTypeDisplay)
    private primitiveDisplay: PrimitiveTypeDisplay;
    @ViewChild(ArrayTypeDisplay)
    private arrayDisplay: ArrayTypeDisplay;
    @ViewChild(PointerTypeDisplay)
    private pointerDisplay: PointerTypeDisplay;
    @ViewChild(FunctionTypeDisplay)
    private functionDisplay: FunctionTypeDisplay;

    public getValue():Value | undefined {
        if(this.type && this.type.data.tType === 'struct') {
            let outVal = {value: {}};
            for(let f of this.type.data.fields) {
                let t = this.types.get(f.sType)!;
                switch(t.data.tType) {
                    case "primitive":
                        outVal.value[f.offset] = this.primitiveDisplay.getValue();
                        break;
                    case "pointer":
                        outVal.value[f.offset] = this.pointerDisplay.getValue();
                        break;
                    case "array":
                        outVal.value[f.offset] = this.arrayDisplay.getValue();
                        break;
                    case "struct":
                        outVal.value[f.offset] = this.structDisplay.getValue();
                        break;
                    case "function":
                        outVal.value[f.offset] = this.functionDisplay.getValue();

                }
            }
            return outVal;
        }
        return undefined;
    }

    public ngOnInit() {

    }

    constructor(){}
}