import {Component, Input, OnInit, ViewChild} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {SourceType} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {StructTypeDisplay} from "./struct-type-display.component";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {ArrayTypeDisplay} from "./array-type-display.component";
import {PointerTypeDisplay} from "./pointer-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";

/**
 * Variable Display Component
 * This flexible component is responsible for displaying any type of Variable and Value passed into it.
 * The component must be passed a type to function and the value will be displayed if it is present.
 * This component just wraps the 5 other display component that specialize in each SourceType.
 * The user entered values can be requested with applyValue().
 */

@Component({
    selector: 'spice-variable-display',
    template: `        
        <span *ngIf="!!debugState && !!type" class="variable-display" [ngClass]="{'normal-size':!compact || editable, 'compact-size':compact && !editable}" [ngSwitch]="type.data.tType">
            <spice-struct-type-display
                    *ngSwitchCase="'struct'"
                    [type]="type"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [lineNum]="lineNum"
                    [types]="debugState.sourceTypes"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primitive'"
                    [type]="type"
                    [value]="value"
                    [compact]="compact && !editable"
                    [editable]="editable"></spice-primitive-type-display>
            <spice-array-type-display
                    *ngSwitchCase="'array'"
                    [type]="type"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [lineNum]="lineNum"
                    [types]="debugState.sourceTypes"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="type"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [lineNum]="lineNum"
                    [types]="debugState.sourceTypes"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="type"
                    [value]="value"
                    [editable]="editable"
                    [compact]="compact && !editable"
                    [types]="debugState.sourceTypes"></spice-function-type-display>
        </span>
    `
})
export class VariableDisplayComponent implements OnInit {

    @Input()
    public type:SourceType;

    @Input()
    public address:number;

    @Input()
    public editable:boolean = false;

    @Input()
    public value:Value;

    @Input()
    public valueMap:{ [sVariable: number]: Value};

    @Input()
    public compact:boolean = false;

    @Input()
    public debugState:DebuggerState;

    @Input()
    public lineNum:number = -1;

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


    constructor(){}

    public ngOnInit() {
        if(this.compact && this.editable) {
            console.log('Both "compact" and "editable" not supported, not displaying compactly.');
        }
    }

    public applyValue(parameters:{[address: number]: Value}) {
        let val:Value|undefined = undefined;
        if(this.debugState && this.type) {
            switch(this.type.data.tType) {
                case "primitive":
                    if(this.primitiveDisplay)
                        val = this.primitiveDisplay.getValue(parameters);
                    break;
                case "pointer":
                    if(this.pointerDisplay)
                        val = this.pointerDisplay.getValue(parameters);
                    break;
                case "array":
                    if(this.arrayDisplay)
                        val = this.arrayDisplay.getValue(parameters);
                    break;
                case "struct":
                    if(this.structDisplay)
                        val = this.structDisplay.getValue(parameters);
                    break;
                case "function":
                    if(this.functionDisplay)
                        val = this.functionDisplay.getValue(parameters);
                    break;
            }
        }
        if(val !== undefined) {
            parameters[this.address] = val;
        }
    }
}