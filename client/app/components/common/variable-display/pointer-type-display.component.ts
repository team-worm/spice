import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-pointer-type-display',
    template: `
        <div>
            <span>{{getTypeName(type)}}</span>
            <button md-raised-button (click)="expanded = !expanded">{{expanded ? 'Hide' : 'Show'}}</button>
        </div>
        <div *ngIf="expanded" [ngSwitch]="types[type.sType]">
            <spice-struct-type-display
                    *ngSwitchCase="'struct'"
                    [variable]="variable"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primative'"
                    [variable]="variable"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"></spice-primitive-type-display>
            <spice-array-type-display
                    *ngSwitchCase="'array'"
                    [variable]="variable"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [variable]="variable"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [variable]="variable"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-function-type-display>
        </div>
    `
})
export class PointerTypeDisplay {
    @Input()
    public variable:any;

    @Input()
    public type:any;

    @Input()
    public value:any;

    @Input()
    public editable:boolean;

    /* Delete Mes */
    @Input()
    public types: {[id: number]: any};
    /* END Delete Mes*/

    public expanded:boolean = false;

    constructor() {}

    public getFullFunctionSignature(type:any):string {
        return (this.getFunctionParametersSignature(type) + ' -> ' + this.getTypeName(this.types[type.sType]));
    }

    public getFunctionParametersSignature(type:any):string {
        let str:string = '( ';
        let first:boolean = true;

        let params:number[] = type.parameters;
        for(let par of params){
            if(first) {
                first = false;
            } else {
                str += ' , ';
            }
            let parType = this.types[par];
            str += this.getTypeName(parType);
        }
        str += ' )';

        return str;
    }

    public getTypeName(type:any):string {
        switch(type.tType) {
            case 'primitive':
                return type.base;
            case 'pointer':
                return (this.getTypeName(this.types[type.sType]) + '*');
            case 'array':
                return (this.getTypeName(type.sType) + '[]');
            case 'function':
                return this.getFullFunctionSignature(type);
            case 'struct':
                return type.name;
            default:
                return 'TypeError';
        }
    }
}