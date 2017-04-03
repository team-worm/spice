import {Component, Input} from "@angular/core";
@Component({
    selector: 'spice-struct-type-display',
    template: `
        <div class="struct">
            <div class="variable-header">
                <span class="variable-subname">{{type.name}}</span>
            </div>
            <table>
                <tr *ngFor="let f of type.fields" [ngSwitch]="types[f.sType].tType">
                    <td>
                        <div class="fieldName">{{f.name}}</div>
                        <div class="fieldType">{{getTypeName(types[f.sType])}}</div>
                    </td>
                    <td>
                        <spice-struct-type-display
                                *ngSwitchCase="'struct'"
                                [type]="types[f.sType]"
                                [types]="types"
                                [editable]="editable"></spice-struct-type-display>
                        <spice-primitive-type-display
                                *ngSwitchCase="'primitive'"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"></spice-primitive-type-display>
                        <spice-array-type-display
                                *ngSwitchCase="'array'"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-array-type-display>
                        <spice-pointer-type-display
                                *ngSwitchCase="'pointer'"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-pointer-type-display>
                        <spice-function-type-display
                                *ngSwitchCase="'function'"
                                [type]="types[f.sType]"
                                [value]="value"
                                [editable]="editable"
                                [types]="types"></spice-function-type-display>
                    </td>
                </tr>
            </table>
        </div>
    `
})
export class StructTypeDisplay{

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

    constructor(){
    }

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