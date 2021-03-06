import {Component, Input, OnInit, QueryList, ViewChildren} from "@angular/core";
import {SourceType, SourceTypeId, Field} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {ArrayTypeDisplay} from "./array-type-display.component";
import {PointerTypeDisplay} from "./pointer-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";

/**
 * Struct Type Display Component
 * This component is responsible for displaying struct SourceTypes
 * It is generated through the Variable Display Components chain of generated variable displays.
 * This generates additional display components for each parameter of the input struct SourceType.
 */

@Component({
    selector: 'spice-struct-type-display',
    template: `
        <div class="struct">
            <div *ngIf="!compact" class="struct-header">
                {{type.data.tType === 'struct' ? type.data.name : 'Type Error'}}
            </div>
            <table >
                <tr *ngFor="let f of getFields()" [ngSwitch]="types.get(f.sType).data.tType">
                    <td>
                        <div class="fieldName">{{f.name}}</div>
                        <div class="fieldType" *ngIf="!compact">{{types.get(f.sType).toString(types)}}</div>
                    </td>
                    <td>
                        <spice-struct-type-display
                                *ngSwitchCase="'struct'"
                                [type]="types.get(f.sType)"
                                [types]="types"
                                [value]="getStructValue(f.offset)"
                                [valueMap]="valueMap"
                                [editable]="editable"
                                [lineNum]="lineNum"
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
                                [lineNum]="lineNum"
                                [compact]="compact && !editable"
                                [types]="types"></spice-array-type-display>
                        <spice-pointer-type-display
                                *ngSwitchCase="'pointer'"
                                [type]="types.get(f.sType)"
                                [value]="getStructValue(f.offset)"
                                [valueMap]="valueMap"
                                [editable]="editable"
                                [lineNum]="lineNum"
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
export class StructTypeDisplay implements OnInit {

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

    @Input()
    public lineNum:number = -1;

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

    private activeVal:Value;

    public getFields(): Field[] {
        return (this.type.data as any).fields;
    }

    public getValue(parameters:{[address: number]: Value}):Value | undefined {
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
                        outVal.value[f.offset] = primDs.pop()!.getValue(parameters);
                        break;
                    case "pointer":
                        outVal.value[f.offset] = poinDs.pop()!.getValue(parameters);
                        break;
                    case "array":
                        outVal.value[f.offset] = arraDs.pop()!.getValue(parameters);
                        break;
                    case "struct":
                        outVal.value[f.offset] = struDs.pop()!.getValue(parameters);
                        break;
                    case "function":
                        outVal.value[f.offset] = funcDs.pop()!.getValue(parameters);

                }
            }
            return outVal;
        }
        return undefined;
    }

    public getStructValue(offset:number):Value | null {
        if(this.activeVal && this.activeVal.value) {
            let val = this.activeVal.value[offset];
            if (val) {
                return val;
            }
        }
        return null;
    }

    constructor(){
    }

    public ngOnInit() {
        if(this.value && this.value.value && Array.isArray(this.value.value) && this.value.value.length > 0) {
            this.activeVal = this.value.value[0];
        } else {
            this.activeVal = this.value;
        }
    }
}
