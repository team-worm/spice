import {Component, Input, OnInit, QueryList, ViewChild, ViewChildren} from "@angular/core";
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
            <div class="struct-header">
                {{type.data.tType === 'struct' ? type.data.name : 'Type Error'}}
            </div>
            <!--<table *ngIf="type.data.tType === 'struct'">-->
            <table >
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
                                [value]="getStructValue(f.offset)"
                                [valueMap]="valueMap"
                                [editable]="editable"
                                [compact]="compact && !editable"></spice-struct-type-display>
                        <spice-primitive-type-display
                                *ngSwitchCase="'primitive'"
                                [type]="types.get(f.sType)"
                                [value]="getStructValue(f.offset)"
                                [editable]="editable"
                                [compact]="compact && !editable"></spice-primitive-type-display>
                        <spice-array-type-display
                                *ngSwitchCase="'array'"
                                [type]="types.get(f.sType)"
                                [value]="getStructValue(f.offset)"
                                [valueMap]="valueMap"
                                [editable]="editable"
                                [compact]="compact && !editable"
                                [types]="types"></spice-array-type-display>
                        <spice-pointer-type-display
                                *ngSwitchCase="'pointer'"
                                [type]="types.get(f.sType)"
                                [value]="getStructValue(f.offset)"
                                [valueMap]="valueMap"
                                [editable]="editable"
                                [compact]="compact && !editable"
                                [types]="types"></spice-pointer-type-display>
                        <spice-function-type-display
                                *ngSwitchCase="'function'"
                                [type]="types.get(f.sType)"
                                [value]="getStructValue(f.offset)"
                                [editable]="editable"
                                [compact]="compact && !editable"
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
    public value:Value = {value:null};

    @Input()
    public valueMap:{ [sVariable: number]: Value};

    @Input()
    public editable:boolean = false;

    @Input()
    public compact:boolean = false;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    @ViewChildren(StructTypeDisplay)
    private structDisplays: QueryList<StructTypeDisplay>;
    @ViewChildren(PrimitiveTypeDisplay)
    private primitiveDisplays: QueryList<PrimitiveTypeDisplay>;
    @ViewChildren(ArrayTypeDisplay)
    private arrayDisplays: QueryList<ArrayTypeDisplay>;
    @ViewChildren(PointerTypeDisplay)
    private pointerDisplays: QueryList<PointerTypeDisplay>;
    @ViewChildren(FunctionTypeDisplay)
    private functionDisplays: QueryList<FunctionTypeDisplay>;

    public getValue():Value | undefined {
        if(this.type && this.type.data.tType === 'struct') {
            let outVal = {value: {}};
            let primDs = this.primitiveDisplays.toArray().reverse();
            let poinDs = this.pointerDisplays.toArray().reverse();
            let arraDs = this.arrayDisplays.toArray().reverse();
            let struDs = this.structDisplays.toArray().reverse();
            let funcDs = this.functionDisplays.toArray().reverse();
            for(let f of this.type.data.fields) {
                let t = this.types.get(f.sType)!;
                switch(t.data.tType) {
                    case "primitive":
                        outVal.value[f.offset] = primDs.pop()!.getValue();
                        break;
                    case "pointer":
                        outVal.value[f.offset] = poinDs.pop()!.getValue();
                        break;
                    case "array":
                        outVal.value[f.offset] = arraDs.pop()!.getValue();
                        break;
                    case "struct":
                        outVal.value[f.offset] = struDs.pop()!.getValue();
                        break;
                    case "function":
                        outVal.value[f.offset] = funcDs.pop()!.getValue();

                }
            }
            return outVal;
        }
        return undefined;
    }

    public getStructValue(offset:number):Value | null {
        if(this.value && this.value.value) {
            let val = this.value.value[offset];
            if(val) {
                return val;
            }
        }
        return null;
    }

    constructor(){
    }
}