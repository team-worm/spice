import {Component, Input, EventEmitter, Output} from "@angular/core";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {DebuggerState} from "../../models/DebuggerState";

/**
 * Function List Component
 * Responsible for displaying a list of SourceFunctions that is passed into this component.
 * The display of each function depends on the type and if it has a breakpoint.
 * This component reports back when a function has been selected.
 * Offers filtering functionality.
 */

@Component({
    selector: 'spice-function-list',
    template: `
<div class="function-list" fxLayout="column" [style.height.px]="elementHeightPx">
    <div fxFlex="noshrink">
        <md-input-container> 
            <md-icon md-prefix>search</md-icon>
            <input mdInput [(ngModel)]="filterString"/>
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
            <p class="function-header" md-line title="{{func.name}} {{getParametersAsString(func)}}"><b>{{func.name}}</b> {{getParametersAsString(func)}}</p>
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

    public getParametersAsString(func:SourceFunction):string {
        if(this.debuggerState && this.debuggerState.sourceTypes) {
            let stMap = this.debuggerState.sourceTypes;
            const parameters = func.parameters
                .map(parameter => {
                    //console.log("ELLIOT!", parameter.sType, stMap, stMap.get(parameter.sType));
                    return `${stMap.get(parameter.sType)!.toString(stMap)} ${parameter.name}`
                })
                .join(", ");

            return `(${parameters})`;
        }
        //console.log("SAM IS MAD!");
        return '';
    }

    constructor() {
        this.onFunctionSelected = new EventEmitter<SourceFunction>();
    }
}
