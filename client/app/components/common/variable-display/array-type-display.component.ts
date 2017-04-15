import {Component, Input, OnInit, QueryList, ViewChildren} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {StructTypeDisplay} from "./struct-type-display.component";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {PointerTypeDisplay} from "./pointer-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";
@Component({
    selector: 'spice-array-type-display',
    template: `        
        <span class="array" *ngIf="types && type && baseType">
            [
            <span class="elements" *ngFor="let i of sizeIterator" [ngSwitch]="baseType.data.tType">
                <spice-struct-type-display
                        #struct
                    *ngSwitchCase="'struct'"
                    [type]="baseType"
                    [types]="types"
                    [value]="baseValues.value[i]"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"></spice-struct-type-display>
                <spice-primitive-type-display
                    *ngSwitchCase="'primitive'"
                    [type]="baseType"
                    [value]="baseValues.value[i]"
                    [editable]="editable"
                    [compact]="compact && !editable"></spice-primitive-type-display>
                <spice-array-type-display
                        #array
                    *ngSwitchCase="'array'"
                    [type]="baseType"
                    [value]="baseValues.value[i]"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-array-type-display>
                <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="baseType"
                    [value]="baseValues.value[i]"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-pointer-type-display>
                <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="baseType"
                    [value]="baseValues.value[i]"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-function-type-display>
                <span *ngIf="i != (sizeIterator.length-1)">,</span>
            </span>
            ]
        </span>
    `
})
export class ArrayTypeDisplay implements OnInit{

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

    @ViewChildren('struct')
    private structDisplays: QueryList<StructTypeDisplay>;
    @ViewChildren(PrimitiveTypeDisplay)
    private primitiveDisplays: QueryList<PrimitiveTypeDisplay>;
    @ViewChildren('array')
    private arrayDisplays: QueryList<ArrayTypeDisplay>;
    @ViewChildren(PointerTypeDisplay)
    private pointerDisplays: QueryList<PointerTypeDisplay>;
    @ViewChildren(FunctionTypeDisplay)
    private functionDisplays: QueryList<FunctionTypeDisplay>;

    public sizeIterator:number[];
    public baseType:SourceType | undefined;
    public baseValues:Value;

    constructor() {}

    public ngOnInit() {
        if(this.type.data.tType === 'array') {
            this.baseType = this.types.get(this.type.data.sType);
            this.sizeIterator = new Array(this.type.data.count);
            for(let i = 0; i < this.type.data.count; i++) {
                this.sizeIterator[i] = i;
            }
        }
        if(this.baseType === undefined) {
            console.error('Pointer base type undefined.', this.type, this.types);
        }
        if(this.value) {
            if(Array.isArray(this.value.value)) {
                this.baseValues = this.value;
            } else {
                console.error('Input Value is not a Value[]', this.value);
            }
        } else {
            this.baseValues = {value: []};
        }

    }

    public getValue(parameters:{[address: number]: Value}):Value | undefined {
        if(this.type && this.type.data.tType === 'array' && this.baseType) {
            let outVals:Value = {value: []};
            let list: QueryList<StructTypeDisplay> | QueryList<PrimitiveTypeDisplay> | QueryList<ArrayTypeDisplay> | QueryList<PointerTypeDisplay>  | QueryList<FunctionTypeDisplay>;
            switch(this.baseType.data.tType) {
                case "primitive":
                    list = this.primitiveDisplays;
                    break;
                case "pointer":
                    list = this.pointerDisplays;
                    break;
                case "array":
                    list = this.arrayDisplays;
                    break;
                case "struct":
                    list = this.structDisplays;
                    break;
                case "function":
                    list = this.functionDisplays;
                    break;
                default:
                    return undefined;
            }
            for(let i of this.sizeIterator) {
                let disp: StructTypeDisplay|PrimitiveTypeDisplay|ArrayTypeDisplay|PointerTypeDisplay|FunctionTypeDisplay = list.toArray()[i];
                let val = disp.getValue(parameters);
                if(val) {
                    if(Array.isArray(outVals.value)) {
                        outVals.value.push(val);
                    }
                }

            }

            return outVals
        }
        return undefined
    }

}