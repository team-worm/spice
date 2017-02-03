import {Component, OnInit} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {Response} from "@angular/http";
import {MdSnackBar} from "@angular/material";

@Component({
    selector: 'spice-configuration',
    templateUrl: 'app/components/configuration/configuration.component.html'
})
export class ConfigurationComponent implements OnInit {

    private _configurationContentBody:HTMLElement | null;

    public sourceFunctions:SourceFunction[];
    public debugState:DebuggerState | null;

    constructor(private debuggerService:DebuggerService,
                private snackBar:MdSnackBar) {
        this.debugState = null;
    }

    public ngOnInit() {
        this._configurationContentBody = document.getElementById('ConfigurationContainer');
        if(!this._configurationContentBody) {
            console.error('Error getting ConfigurationContainer');
        }
    }

    public Reload() {
        let ds:DebuggerState|null = null;
        if(ds = this.debuggerService.getCurrentDebuggerState()) {
            this.debugState = ds;
            let self = this;
            ds.getSourceFunctions().subscribe({
                next: (sfMap:{[id: string]: SourceFunction})=>{
                    self.sourceFunctions = Object.keys(sfMap).map((key:string)=> {return sfMap[key]});
                },
                complete: ()=>{},
                error: (error:Response)=>{
                    console.log(error);
                    self.snackBar.open('Error getting Source Functions', undefined, {
                        duration: 3000
                    });
                }
            })
        } else {
            this.snackBar.open('Not attached.', undefined, {
                duration: 3000
            });
        }
    }


    public GetRowHeight():number {

        if(!this._configurationContentBody) {
            return 50;
        }

        return  ((window.innerHeight - this._configurationContentBody.offsetTop) / 4) - 2;

    }
}