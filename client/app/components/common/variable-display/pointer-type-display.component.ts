import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-pointer-type-display',
    template: `
        <div class="pointer" (click)="expanded = !expanded" [ngClass]="{'expanded':expanded}">
            {{getTypeName(type)}}<md-icon>{{expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}}</md-icon>
        </div>
        <div class="pointer-contents" *ngIf="expanded" [ngSwitch]="types[type.sType].tType">
            <spice-struct-type-display
                    *ngSwitchCase="'struct'"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-struct-type-display>
            <spice-primitive-type-display
                    *ngSwitchCase="'primative'"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"></spice-primitive-type-display>
            <spice-array-type-display
                    *ngSwitchCase="'array'"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-array-type-display>
            <spice-pointer-type-display
                    *ngSwitchCase="'pointer'"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-pointer-type-display>
            <spice-function-type-display
                    *ngSwitchCase="'function'"
                    [type]="types[type.sType]"
                    [value]="value"
                    [editable]="editable"
                    [types]="types"></spice-function-type-display>
        </div>
    `
})
export class PointerTypeDisplay {

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