import {Component, Input, EventEmitter, Output} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";

@Component({
    selector: 'spice-function-list',
    template: `
I am a list of functions
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