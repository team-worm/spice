import {Component, OnInit} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";
import {MdDialogRef} from "@angular/material";
@Component({
    selector: 'spice-type-mapping',
    template: `        
        <h2 md-dialog-title><b>{{func.name}}</b> Locals</h2>
    <md-dialog-content>
        <img src="https://i.imgur.com/OvMZBs9.jpg">
        <div *ngFor="let local of func.locals">
            {{local.name}}
        </div>
    </md-dialog-content>
    <md-dialog-actions>
        <button md-raised-button>Save</button>
        <button md-raised-button md-dialog-close>Cancel</button>
    </md-dialog-actions>`
})
export class TypeMappingComponent implements OnInit{

    public func:SourceFunction;

    constructor(private dialogRef: MdDialogRef<TypeMappingComponent>){
    }

    ngOnInit() {
        this.func = <SourceFunction> this.dialogRef._containerInstance.dialogConfig.data;
    }
}
