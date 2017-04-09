import {Component, Input} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
@Component({
    selector: 'spice-array-type-display',
    template: `        
        <div>Array of {{types[type.sType].base}} [{{type.count}}] <b>TODO</b></div>
    `
})
export class ArrayTypeDisplay {

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