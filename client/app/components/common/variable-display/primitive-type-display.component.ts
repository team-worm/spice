import {Component, Input, OnInit} from "@angular/core";
import {SourceType} from "../../../models/SourceType";
@Component({
    selector: 'spice-primitive-type-display',
    template: `
        <md-input-container class="primitive input" *ngIf="typeOfInput() === 'number'">
            <input mdInput 
                placeholder="{{type.data.base}}" 
                [disabled]="!editable" 
                value="" 
                type="{{inputType()}}" 
                min="{{inputMin()}}"
                max="{{inputMax()}}">
        </md-input-container>
        <div class="primitive bool" *ngIf="typeOfInput() === 'boolean'">
            <md-slide-toggle [disabled]="!editable"></md-slide-toggle> 
        </div>
        <div class="primitive null" *ngIf="typeOfInput() === 'none'">
            NULL
        </div>
        
    `
})
export class PrimitiveTypeDisplay {

    @Input()
    public type:SourceType;

    @Input()
    public value:any;

    @Input()
    public editable:boolean = true;

    constructor(){}

    public typeOfInput():string {
        if(this.type.data.tType === 'primitive') {
            switch(this.type.data.base) {
                case 'void':
                    return 'none';
                case 'bool':
                    return 'boolean';
                case 'int':
                case 'uint':
                case 'float':
                    return 'number';
                default:
                    return 'none'
            }
        } else {
            return 'none';
        }

    }

    public inputMax():number|string {
        if(this.type.data.tType === 'primitive') {
            let size:number = this.type.data.size;
            let max:number = (Math.pow(2,8*size) - 2) / 2;
            let maxU:number = (max*2)+1;

            switch(this.type.data.base) {
                case 'int':
                    return max;
                case 'uint':
                    return maxU;
                default:
                    return '';
            }
        } else {
            return '';
        }

    }
    public inputMin():number|string {
        if(this.type.data.tType === 'primitive') {
            let size:number = this.type.data.size;
            let max:number = (Math.pow(2,8*size) - 2) / 2;
            let min:number = (max + 1) * -1;

            switch(this.type.data.base) {
                case 'int':
                    return min;
                case 'uint':
                    return 0;
                default:
                    return '';
            }
        } else {
            return '';
        }
    }

    public inputType():string {
        if(this.type.data.tType === 'primitive') {
            switch(this.type.data.base) {
                case 'int':
                case 'uint':
                case 'float':
                    return 'number';
                default:
                    return ''
            }
        } else {
            return '';
        }
    }
}