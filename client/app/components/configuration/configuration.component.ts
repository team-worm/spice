import {Component, OnInit} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {MdSnackBar} from "@angular/material";
import {Breakpoint} from "../../models/Breakpoint";
import {Execution} from "../../models/execution/Execution";
import {Trace} from "../../models/trace/Trace";

@Component({
    selector: 'spice-configuration',
    templateUrl: 'app/components/configuration/configuration.component.html'
})
export class ConfigurationComponent implements OnInit {

    private _configurationContentBody:HTMLElement | null;

    public selectedFunction:SourceFunction | null;
    public setBreakpoint:Breakpoint | null;
    public sourceFunctions:SourceFunction[];
    public debugState:DebuggerState | null;

    constructor(private debuggerService:DebuggerService,
                private snackBar:MdSnackBar) {
        this.selectedFunction = null;
        this.setBreakpoint = null;
        this.debugState = null;
    }

    public ngOnInit() {
        this._configurationContentBody = document.getElementById('ConfigurationContainer');
        if(!this._configurationContentBody) {
            console.error('Error getting ConfigurationContainer');
        }
    }

    public SetBreakpoint() {
        if(this.selectedFunction && this.debugState) {
            this.debugState.setBreakpoint(this.selectedFunction.id).subscribe({
                next: (bp:Breakpoint)=>{
                    this.setBreakpoint = bp;
                },
                complete: ()=>{},
                error: (error:any) => {
                    console.log(error);
                    this.snackBar.open('Error getting Source Functions', undefined, {
                        duration: 3000
                    });
                }
            });
        } else {
            this.snackBar.open('No function selected.', undefined, {
                duration: 3000
            });
        }
    }

    public RunFunction() {
        if(this.setBreakpoint && this.debugState) {
           this.debugState.executeBinary('','').subscribe({
               next: (ex:Execution)=>{
                   console.log(ex);
                   if(this.debugState) {
                       this.debugState.getTrace(ex.id).subscribe((t:Trace)=> {
                           console.log(t);
                       })
                   }

               },
               complete: ()=>{},
               error: (error:any) => {
                   console.log(error);
                   this.snackBar.open('Error getting Source Functions', undefined, {
                       duration: 3000
                   });
               }
           });
        } else {
            this.snackBar.open('No breakpoint set.', undefined, {
                duration: 3000
            });
        }
    }

    public Reload() {
        let ds:DebuggerState|null = null;
        if(ds = this.debuggerService.getCurrentDebuggerState()) {
            this.debugState = ds;
            ds.getSourceFunctions().subscribe({
                next: (sfMap:{[id: string]: SourceFunction})=>{
                    this.sourceFunctions = Object.keys(sfMap).map((key:string)=> {return sfMap[key]});
                },
                complete: ()=>{},
                error: (error:any)=>{
                    console.log(error);
                    this.snackBar.open('Error getting Source Functions', undefined, {
                        duration: 3000
                    });
                }
            })
        } else {
            this.snackBar.open('Not attached to a process.', undefined, {
                duration: 3000
            });
        }
    }

    public OnFunctionSelected($event:SourceFunction) {
        this.selectedFunction = $event;
    }

    public GetFullCardHeight():number {

        if(!this._configurationContentBody) {
            return 50;
        }
        return  (window.innerHeight - this._configurationContentBody.offsetTop) - 64;

    }

    public GetSelectedFunctionAsString():string {
        if(!this.selectedFunction) {
            return 'none';
        } else {
            return this.selectedFunction.name + ' ' + this.selectedFunction.GetParametersAsString();
        }
    }
    public GetListHeight():number {
        return this.GetFullCardHeight() - 32;
    }
}