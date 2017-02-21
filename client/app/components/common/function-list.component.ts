import {Component, Input, EventEmitter, Output} from "@angular/core";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {SourceType} from "../../models/SourceType";
import {DebuggerState} from "../../models/DebuggerState";

@Component({
    selector: 'spice-function-list',
    template: `
<div class="function-list" fxLayout="column" [style.height.px]="elementHeightPx">
<div class="small-padding" fxFlex="noshrink">
    <md-input-container> 
        <md-icon md-prefix>search</md-icon>
        <input md-input [(ngModel)]="filterString"/>
    </md-input-container>
</div>
<md-list dense fxFlex="grow">
    <md-list-item
        class="function-list-item"
        [ngClass]="{'selected': selectedFunction == func}"
        *ngFor="let func of SortNameAscending() | filterByString:filterString:FunctionToString" 
        (click)="FunctionClicked(func)">
        <md-icon class="function-icon" md-list-avatar *ngIf="!FunctionHasBreakpoint(func.id)">library_books</md-icon>
        <md-icon class="function-icon" md-list-avatar *ngIf="FunctionHasBreakpoint(func.id)">book</md-icon>
        <p class="function-header" md-line title="{{func.name}} {{func.getParametersAsString()}}"><b>{{func.name}}</b> {{func.getParametersAsString()}}</p>
        <p class="function-subheader" md-line title="{{func.sourcePath}}">{{func.sourcePath}}</p>
    </md-list-item>
</md-list>
</div>
`
})
export class FunctionListComponent{

    public filterString:string;
    public selectedFunction:SourceFunction;

    @Input()
    public elementHeightPx:number;

    @Input()
    public sourceFunctions: SourceFunction[];

    @Input()
    public debuggerState: DebuggerState;

    @Output()
    public onFunctionSelected: EventEmitter<SourceFunction>;

    public FunctionToString(func:SourceFunction) {
        return func.name;
    }

    public FunctionClicked(func:SourceFunction) {
        this.selectedFunction = func;
        this.onFunctionSelected.emit(func);
    }

    public FunctionHasBreakpoint(id:SourceFunctionId) {
        if(!this.debuggerState) {
            return false;
        }
        return this.debuggerState.breakpoints.has(id);
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
