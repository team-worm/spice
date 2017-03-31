import {Component, Input, OnInit} from "@angular/core";
@Component({
    selector: 'spice-primitive-type-display',
    template: `
        <md-input-container class="primitive" *ngIf="type.base != 'void'">
            <input mdInput 
                placeholder="{{variable.name}} ({{type.base}}_{{8*type.size}})" 
                [disabled]="!editable" 
                value="" 
                type="{{inputType()}}" 
                min="{{inputMin()}}"
                max="{{inputMax()}}">
        </md-input-container>
        <md-input-container class="primitive" *ngIf="type.base === 'void'">
            <input mdInput
                   placeholder="{{variable.name}} ({{type.base}})"
                   [disabled]="true"
                   value="NULL">
        </md-input-container>
        
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

        this.variable = {
            name:"Third",
            sType:2,
            offset:8
        };
        this.type = { //TODO: Remove Me
            tType: "primitive",
            base: "bool",
            size: 1
        }
    }

    public ngOnInit() {
        //TODO Type Validation
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