import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
import {StructTypeDisplay} from "./struct-type-display.component";
import {PrimitiveTypeDisplay} from "./primitive-type-display.component";
import {ArrayTypeDisplay} from "./array-type-display.component";
import {PointerTypeDisplay} from "./pointer-type-display.component";
import {FunctionTypeDisplay} from "./function-type-display.component";

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
                    [types]="debugState.sourceTypes"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="type"
                    [value]="value"
                    [valueMap]="valueMap"
                    [editable]="editable"
                    [compact]="compact && !editable"
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

    public getValue():Value | undefined {
        if(this.debugState && this.type) {
            switch(this.type.data.tType) {
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
        return undefined;
    }
}