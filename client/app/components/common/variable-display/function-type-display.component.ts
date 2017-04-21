import {Component, Input} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";

/**
 * Function Type Display Component
 * This component is responsible for displaying function SourceTypes
 * It is generated through the Variable Display Components chain of generated variable displays.
 * This is the least complex and feature rich of the display on inline functions is really complicated and not making it into the final release
 */

@Component({
    selector: 'spice-function-type-display',
    template: `
        <span class="function">
            <div>
                {{type.toString(types)}}
            </div>
            <div class="edit-warning" *ngIf="editable">
                Editing functions is not available in the Spice Debugger
            </div>
        </span>
    `
})
export class FunctionTypeDisplay {

    @Input()
    public type:SourceType;

    @Input()
    public value:Value;

    @Input()
    public editable:boolean = false;

    @Input()
    public compact:boolean = false;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    public getValue(parameters:{[address: number]: Value}):Value | undefined {
        /* Not implemented by final release of Spice.
        *  Modifying functions in Spice could be very complicated and definitely out of scope by graduation.
        * */
        return this.value ? this.value : {value: null};
    }

    constructor() {}

}