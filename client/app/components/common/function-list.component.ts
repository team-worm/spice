import {Component, Input, EventEmitter, Output} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";

@Component({
    selector: 'spice-function-list',
    template: `
<div style="overflow-y:scroll">
<md-list dense>
    <md-list-item *ngFor="let function of SortNameAscending() | filterByString:filterString:FunctionToString" (click)="FunctionClicked(function)">
        <md-icon md-list-avatar>extension</md-icon>
        <p md-line>{{function.name}}</p>
    </md-list-item>
</md-list>
</div>
`
})
export class FunctionListComponent{

    public filterString:string;

    @Input()
    public sourceFunctions: SourceFunction[];

    @Output()
    public onFunctionSelected: EventEmitter<SourceFunction>;

    public FunctionToString(func:SourceFunction) {
        return func.name;
    }

    public FunctionClicked(func:SourceFunction) {
        alert('todo' + func.name);
    }

    public SortNameAscending(): SourceFunction[] {
        if(this.sourceFunctions) {
            this.sourceFunctions.sort((a:SourceFunction, b:SourceFunction)=> {
                if(a.name < b.name) {
                    return -1;
                } else if(a.name > b.name) {
                    return 1;
                }
                return 0;
            });
        }

        return this.sourceFunctions;
    }

    constructor() {
        this.onFunctionSelected = new EventEmitter<SourceFunction>();
    }
}