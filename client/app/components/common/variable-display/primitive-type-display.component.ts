import {
    AfterContentInit, AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit,
    ViewChild
} from "@angular/core";
import {SourceType} from "../../../models/SourceType";
import {Value} from "../../../models/Value";
@Component({
    selector: 'spice-primitive-type-display',
    template: `
        
        <!--<input   *ngIf="typeOfInput() === 'number'" -->
                 <!--placeholder="{{type.data.base}}"/>-->
        
        <md-input-container class="primitive input" *ngIf="typeOfInput() === 'number'">
            <input mdInput
                #inputComp
                placeholder="{{type.data.base}}" 
                [disabled]="!editable"
                value="{{value ? value.value : ''}}"
                type="{{inputType()}}"
                min="{{inputMin()}}"
                max="{{inputMax()}}">
        </md-input-container>
        <div class="primitive bool" *ngIf="typeOfInput() === 'boolean'">
            <md-checkbox 
                    [disabled]="!editable"
                    #inputComp></md-checkbox> 
        </div>
        <div class="primitive null" *ngIf="typeOfInput() === 'none'">
            NULL
        </div>
    `
})
export class PrimitiveTypeDisplay {
//FIX: [(ngModel)]="inputVal"
    @Input()
    public type:SourceType;

    @Input()
    public value:Value;

    @Input()
    public editable:boolean = false;

    @ViewChild('inputComp')
    public inputEl:ElementRef;


    constructor(){
    }

    // public ngAfterViewInit() {
    //     console.log("ON Init outer!", this.value, this.inputEl);
    //     setTimeout(()=>{
    //         if(this.inputEl && this.inputEl.nativeElement && this.value && this.value.value != null) {
    //             console.log("On Init inner!", this.value);
    //             (<HTMLInputElement> this.inputEl.nativeElement).defaultValue = this.value.value.toString();
    //         }
    //     },0);
    //
    // }

    public getValue():Value | undefined {
        if(this.type && this.type.data.tType === 'primitive') {
            let inputVal = (<HTMLInputElement> this.inputEl.nativeElement).value;
            switch(this.type.data.base) {
                case 'void':
                    return {value: null};
                case 'bool':
                    return {value: !!inputVal};
                case 'int':
                    if(this.isNumeric(inputVal)) {
                        return {value: parseInt(inputVal)};
                    }
                    break;
                case 'uint':
                    if(this.isNumeric(inputVal) && parseInt(inputVal) >= 0) {
                        return {value: parseInt(inputVal)};
                    }
                    break;
                case 'float':
                    if(this.isNumeric(inputVal)) {
                        return {value: parseFloat(inputVal)}
                    }

            }
        }
        return undefined;
    }

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

    private isNumeric(n:any):boolean {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
}