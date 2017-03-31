import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-primitive-type-display',
    template: `
        
        <md-input-container class="primitive" *ngIf="typeOfInput() === 'number'">
            <input mdInput 
                placeholder="{{type.base}}" 
                [disabled]="!editable" 
                value="" 
                type="{{inputType()}}" 
                min="{{inputMin()}}"
                max="{{inputMax()}}">
        </md-input-container>
        <div class="primitive" *ngIf="typeOfInput() === 'boolean'">
            <md-slide-toggle [disabled]="!editable"></md-slide-toggle> 
        </div>
        <div class="primitive null" *ngIf="typeOfInput() === 'none'">
            NULL
        </div>
        
    `
})
export class PrimitiveTypeDisplay implements OnInit{
    @Input()
    public variable:any;

    @Input()
    public type:any;

    @Input()
    public value:any;

    @Input()
    public editable:boolean = true;

    constructor(){

    }

    public ngOnInit() {
        //TODO Type Validation
    }

    public typeOfInput():string {
        switch(this.type.base) {
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
    }

    public inputMax():number|string {
        let size:number = this.type.size;
        let max:number = (Math.pow(2,8*size) - 2) / 2;
        let maxU:number = (max*2)+1;

        switch(this.type.base) {
            case 'int':
                return max;
            case 'uint':
                return maxU;
            default:
                return '';
        }
    }
    public inputMin():number|string{
        let size:number = this.type.size;
        let max:number = (Math.pow(2,8*size) - 2) / 2;
        let min:number = (max + 1) * -1;

        switch(this.type.base) {
            case 'int':
                return min;
            case 'uint':
                return 0;
            default:
                return '';
        }
    }

    public inputType():string {
        switch(this.type.base) {
            case 'int':
            case 'uint':
            case 'float':
                return 'number';
            default:
                return ''
        }
    }
}