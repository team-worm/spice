import {Component, EventEmitter, Input, Output} from "@angular/core";
import {DebuggerState} from "../../../models/DebuggerState";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";

@Component({
    selector: 'spice-variable-display',
    template: `        
        <div *ngIf="!!debugState && !!type" class="variable-display">
            <div [ngSwitch]="type.data.tType">
                <spice-struct-type-display
                        *ngSwitchCase="'struct'"
                        [type]="type"
                        [value]="value"
                        [editable]="editable"
                        [types]="debugState.sourceTypes"></spice-struct-type-display>
                <spice-primitive-type-display
                        *ngSwitchCase="'primitive'"
                        [type]="type"
                        [value]="value"
                        [editable]="editable"></spice-primitive-type-display>
                <spice-array-type-display
                        *ngSwitchCase="'array'"
                        [type]="type"
                        [value]="value"
                        [editable]="editable"
                        [types]="debugState.sourceTypes"></spice-array-type-display>
                <spice-pointer-type-display
                        *ngSwitchCase="'pointer'"
                        [type]="type"
                        [value]="value"
                        [editable]="editable"
                        [types]="debugState.sourceTypes"></spice-pointer-type-display>
                <spice-function-type-display
                        *ngSwitchCase="'function'"
                        [type]="type"
                        [value]="value"
                        [editable]="editable"
                        [types]="debugState.sourceTypes"></spice-function-type-display>
            </div>
        </div>
    `
})
export class VariableDisplayComponent {

    @Input()
    public type:SourceType;

    @Input()
    public address:number;

    @Input()
    public editable:boolean;

    @Input()
    public debugState:DebuggerState;

    @Output()
    public valueChange = new EventEmitter<{address:number, val:Value}>();

    constructor(){}
}