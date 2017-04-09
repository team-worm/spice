import {Component, Input, OnInit} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
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
    public value:any;

    @Input()
    public editable:boolean;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    constructor() {}

}