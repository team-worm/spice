import {Component, Input, OnInit, ViewChild} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";
import { MatchMaxHeightDirective } from "../../../directives/MatchMaxHeight.directive";

/**
 * Pointer Type Display Component
 * This component is responsible for displaying pointer SourceTypes
 * It is generated through the Variable Display Components chain of generated variable displays.
 * This generates an additional display component for the type/value this pointer points to.
 */

@Component({
    selector: 'spice-pointer-type-display',
    template: `        
        <span   *ngIf="types && type && canExpand()" (click)="expanded = !expanded"
                class="pointer"  
                title="{{expanded ? 'Hide pointer contents.' : 'Show pointer contents.'}}"
                [ngClass]="{'expanded':expanded}">
            {{type.toString(types)}}<md-icon *ngIf="expanded">keyboard_arrow_right</md-icon>
        </span>
        <span *ngIf="types && type && !canExpand()" class="pointer empty">
            NULL
        </span>
        <span class="pointer-contents" *ngIf="expanded && types && type && canExpand()" [ngSwitch]="types.get(type.data.sType).data.tType">
            <spice-struct-type-display
                    #struct
                    *ngSwitchCase="'struct'"
                    [type]="types.get(type.data.sType)"
                    [value]="childValue"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [lineNum]="lineNum"
                    [compact]="compact && !editable"
                    [types]="types"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primitive'"
                    [type]="types.get(type.data.sType)"
                    [value]="childValue"
                    [editable]="editable"
                    [compact]="compact && !editable"></spice-primitive-type-display>
            <spice-array-type-display
                    #array
                    *ngSwitchCase="'array'"
                    [type]="types.get(type.data.sType)"
                    [value]="childValue"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [lineNum]="lineNum"
                    [compact]="compact && !editable"
                    [types]="types"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="types.get(type.data.sType)"
                    [value]="childValue"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [lineNum]="lineNum"
                    [compact]="compact && !editable"
                    [types]="types"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="types.get(type.data.sType)"
                    [value]="childValue"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="types"></spice-function-type-display>
        </span>
    `
})
export class PointerTypeDisplay implements OnInit {

    @Input()
    public type:SourceType;

    @Input()
    public value:Value;

    @Input()
    public valueMap:{ [sVariable: number]: Value} = {};

    @Input()
    public editable:boolean = false;

    @Input()
    public compact:boolean = false;

    @Input()
    public lineNum:number = -1;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    @ViewChild('struct')
    private structDisplay: any;
    @ViewChild(PrimitiveTypeDisplay)
    private primitiveDisplay: PrimitiveTypeDisplay;
    @ViewChild('array')
    private arrayDisplay: any;
    @ViewChild(PointerTypeDisplay)
    private pointerDisplay: PointerTypeDisplay;
    @ViewChild(FunctionTypeDisplay)
    private functionDisplay: FunctionTypeDisplay;

    public childValue:Value | null = null;

    private _expanded:boolean;
    public get expanded() {
        return this._expanded;
    }
    public set expanded(val:boolean) {
        if(this.lineNum !== -1) {
            MatchMaxHeightDirective.markDirty(`debugger-${this.lineNum}`)
        }
        this._expanded = val;
    }

    public getValue(parameters:{[address: number]: Value}):Value | undefined {

        let targetVal:Value|undefined = undefined;

        if(this.type && this.types && this.type.data.tType === 'pointer') {
            let targetType = this.types.get(this.type.data.sType)!;

            switch(targetType.data.tType) {
                case "primitive":
                    if(this.primitiveDisplay)
                        targetVal = this.primitiveDisplay.getValue(parameters);
                    break;
                case "pointer":
                    if(this.pointerDisplay)
                        targetVal = this.pointerDisplay.getValue(parameters);
                    break;
                case "array":
                    if(this.arrayDisplay)
                        targetVal = this.arrayDisplay.getValue(parameters);
                    break;
                case "struct":
                    if(this.structDisplay)
                        targetVal = this.structDisplay.getValue(parameters);
                    break;
                case "function":
                    if(this.functionDisplay)
                        targetVal = this.functionDisplay.getValue(parameters);
                    break;
            }
        }

        if(targetVal != undefined) {
            //Find available key
            let i:number;
            for(i = 3; i < Math.pow(2,31); i++) {
                if(!parameters[i]) {
                   break;
                }
            }
            parameters[i] = targetVal;
            return {value: i};

        } else {
            return undefined;
        }
    }

    public canExpand():boolean {
        if(!this.editable) {
            if(!this.value || !this.value.value) {
                return false;
            }
        }
        return true
    }
    public ngOnInit() {
        if(this.value && this.valueMap) {
            if(this.value.value !== null) {
                let n = parseInt(this.value.value.toString());
                this.childValue = this.valueMap[n];
            }
        }
    }

    constructor() {}
}