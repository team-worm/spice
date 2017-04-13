import {Component, Input} from "@angular/core";
import {SourceType, SourceTypeId} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
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
    public value:Value;

    @Input()
    public editable:boolean;

    @Input()
    public types:Map<SourceTypeId, SourceType>;

    public getValue():Value | undefined {
        return this.value ? this.value : {value: null};
    }

    constructor() {}
}