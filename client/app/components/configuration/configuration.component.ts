import {Component, OnInit, AfterViewChecked} from "@angular/core";
import {SourceFunction} from "../../models/SourceFunction";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {MdSnackBar} from "@angular/material";
import {Breakpoint} from "../../models/Breakpoint";
import {Execution} from "../../models/execution/Execution";
import {Trace} from "../../models/trace/Trace";
import {TraceOfTermination} from "../../models/trace/TraceOfTermination";
import {ViewService} from "../../services/view.service";
import {Observable} from "rxjs/Observable";
import {ExecutionOfFunction} from "../../models/execution/ExecutionOfFunction";
import {FileSystemService} from "../../services/file-system.service";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";

@Component({
    selector: 'spice-configuration',
    templateUrl: 'app/components/configuration/configuration.component.html'
})
export class ConfigurationComponent implements OnInit, AfterViewChecked {

    private _configurationContentBody:HTMLElement | null;

    public lines:string[] | null;
    public linesLoaded:boolean = true;

    public selectedFunction:SourceFunction | null;
    public setBreakpoint:Breakpoint | null;
    public sourceFunctions:SourceFunction[];
    public debugState:DebuggerState | null;

    public setParameters:{[id: string]: any};

    constructor(private debuggerService:DebuggerService,
                private snackBar:MdSnackBar,
                private viewService: ViewService,
                private fileSystemService: FileSystemService) {
        this.selectedFunction = null;
        this.setBreakpoint = null;
        this.debugState = null;
        this.lines = [];
    }

    public ngOnInit() {
        this._configurationContentBody = document.getElementById('ConfigurationContainer');
        if(!this._configurationContentBody) {
            console.error('Error getting ConfigurationContainer');
        }
    }

    public ngAfterViewChecked() {
		//TODO: fix this so it doesn't just execute on any update
		if(this.lines) {
			this.lines.forEach((l,i) => MatchMaxHeightDirective.update('configuration-'+i.toString()));
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

    public ExecuteFunction() {
        if(this.debugState && this.selectedFunction) {
            this.debugState.executeFunction(this.selectedFunction.id,this.setParameters)
                .subscribe((ex:Execution)=>{
                    if (this.viewService.debuggerComponent) {
                        this.viewService.debuggerComponent.displayTrace(ex.id);
                        this.viewService.activeView = "Debugger";
                    }
                }, (e:any) => {
                    console.error(e);
                });
        } else {
            this.snackBar.open('No breakpoint set.', undefined, {
                duration: 3000
            });
        }
    }

    public ExecuteBinary() {
        if(this.debugState) {
           this.debugState.executeBinary('','')
               .mergeMap((ex:Execution)=>{
                   if(!this.debugState) {
                        return Observable.throw(new Error('Null debug state'));
                   }
                   return this.debugState.getTrace(ex.id);
               }).map((t:Trace)=> {
                    if(t.tType === 2) {
                       let tTerm: TraceOfTermination = t as TraceOfTermination;
                       if (tTerm.data.cause === 'breakpoint') {
                           if (this.viewService.debuggerComponent) {
                               this.viewService.debuggerComponent.displayTrace(tTerm.data.nextExecution);
                               this.viewService.activeView = "Debugger";
                           }
                       }
                    }
                    return t;
                   }).subscribe({
                   next: (t)=>{},
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

    public loadSourceFunctions() {
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
        this.lines = null;
        this.setParameters = {};
        this.fileSystemService.getFileContents($event.sourcePath).subscribe((contents:string)=> {
            this.lines = contents.split('\n');
            this.linesLoaded = true;
            //TODO: figure out how to do this without a delay
            //Observable.of(null).delay(100).subscribe(() => this.refreshHeights());
        }, (error:Error)=> {
            this.lines = [];
            this.linesLoaded = false;
        });
        this.selectedFunction = $event;
    }

    public GetFullCardHeight():number {

        if(!this._configurationContentBody) {
            return 50;
        }
        return  (window.innerHeight - this._configurationContentBody.offsetTop) - 64;

    }

    public refreshHeights(): void {
        if(!!this.lines) {
            this.lines.forEach((l,i) => MatchMaxHeightDirective.update('configuration-'+i.toString()));
        }
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
