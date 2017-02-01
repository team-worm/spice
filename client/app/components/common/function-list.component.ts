import {Component, Input, EventEmitter, Output} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";

@Component({
    selector: 'spice-function-list',
    template: `
<div>I am a TODO function list component.</div>
`
})
export class FunctionListComponent{

    @Input()
    public sourceFunctions: SourceFunction[];

    @Output()
    public onFunctionSelected: EventEmitter<SourceFunction>;

    constructor() {
        this.onFunctionSelected = new EventEmitter<SourceFunction>();
    }
}