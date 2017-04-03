import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-function-type-display',
    template: `
        <span class="function">
            <div>
                <span>{{getFunctionParametersSignature(type)}}</span>
                <md-icon>arrow_forward</md-icon>
                <span>{{getTypeName(types[type.sType])}}</span> 
            </div>
            <div class="edit-warning" *ngIf="editable">
                Editing functions is not available in the Spice Debugger
            </div>
        </span>
    `
})
export class FunctionTypeDisplay {

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