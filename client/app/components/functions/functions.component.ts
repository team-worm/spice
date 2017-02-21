import { Component, OnInit } from "@angular/core";
import { SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {MdSnackBar} from "@angular/material";
import {Breakpoint} from "../../models/Breakpoint";
import {ViewService} from "../../services/view.service";
import {FileSystemService} from "../../services/file-system.service";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";

@Component({
    selector: 'spice-configuration',
    templateUrl: 'app/components/functions/functions.component.html'
})
export class FunctionsComponent implements OnInit {

    private _functionsContentBody: HTMLElement | null;

    public lines: string[] | null;
    public linesLoaded: boolean = true;

    public selectedFunction: SourceFunction | null;
    public sourceFunctions: SourceFunction[];
    public debugState: DebuggerState | null;

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar,
                private viewService: ViewService,
                private fileSystemService: FileSystemService) {
        this.selectedFunction = null;
        this.debugState = null;
        this.lines = [];
    }

    public ngOnInit() {
        this._functionsContentBody = document.getElementById('FunctionsContainer');
        if (!this._functionsContentBody) {
            console.error('Error getting FunctionsContainer');
        }
    }

    public ngAfterViewChecked() {
        //TODO: fix this so it doesn't just execute on any update
        if (this.lines) {
            this.lines.forEach((l, i) => MatchMaxHeightDirective.update('functions-' + i.toString()));
        }
    }

    public ToggleBreakpoint() {
        if(this.selectedFunction && this.debugState) {
            if (this.debugState.breakpoints.has(this.selectedFunction.address)) {
                this.removeBreakpoint(this.debugState, this.selectedFunction.address);
            } else {
                this.addBreakpoint(this.debugState, this.selectedFunction.address);
            }
        } else {
            this.snackBar.open('No function selected.', undefined, {
                duration: 3000
            });
        }
    }

    public ExecuteBinary() {
        if (this.viewService.toolbarComponent) {
            this.viewService.toolbarComponent.ExecuteBinary();
        }
    }

    public loadSourceFunctions() {
        let ds: DebuggerState|null = null;
        if (ds = this.debuggerService.getCurrentDebuggerState()) {
            this.debugState = ds;
            ds.getSourceFunctions().subscribe({
                next: (sfMap: {[id: string]: SourceFunction}) => {
                    this.sourceFunctions = Object.keys(sfMap).map((key: string) => {
                        return sfMap[key]
                    });
                },
                complete: () => {
                },
                error: (error: any) => {
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

    public OnFunctionSelected($event: SourceFunction) {
        this.lines = null;
        this.linesLoaded = false;
        this.fileSystemService.getFileContents($event.sourcePath).subscribe((contents: string) => {
            this.lines = contents.split('\n');
            this.linesLoaded = true;
            this.refreshHeights();
        }, (error:Error)=> {
            this.lines = [];
            this.linesLoaded = false;
        });
        this.selectedFunction = $event;
    }

    public GetFullCardHeight(): number {

        if (!this._functionsContentBody) {
            return 50;
        }
        return (window.innerHeight - this._functionsContentBody.offsetTop) - 64;

    }

    public refreshHeights(): void {
        if(!!this.lines) {
            this.lines.forEach((l,i) => MatchMaxHeightDirective.markDirty('functions-'+i.toString()));
        }
    }

    public GetSelectedFunctionAsString(): string {
        if (!this.selectedFunction) {
            return 'none';
        } else {
            return this.selectedFunction.name + ' ' + this.selectedFunction.getParametersAsString();
        }
    }

    public GetListHeight(): number {
        return this.GetFullCardHeight() - 32;
    }

    public ExecuteFunctionWithCustomParams() {
        if (this.viewService.debuggerComponent) {
            this.viewService.debuggerComponent.setParameters = {};
            this.viewService.debuggerComponent.sourceFunction = this.selectedFunction;
            this.viewService.activeView = 'debugger';
        }
    }

    private addBreakpoint(ds: DebuggerState, id: SourceFunctionId) {
        ds.setBreakpoint(id).subscribe({
            next: (bp: Breakpoint) => {
            },
            complete: () => {
            },
            error: (error: any) => {
                console.log(error);
                this.snackBar.open('Error getting Source Functions', undefined, {
                    duration: 3000
                });
            }
        });
    }

    private removeBreakpoint(ds: DebuggerState, id: SourceFunctionId) {
        ds.removeBreakpoint(id).subscribe({
            next: () => {
                //Removed Breakpoints
            },
            complete: () => {
            },
            error: (error: any) => {
                console.log(error);
                this.snackBar.open('Error getting Source Functions', undefined, {
                    duration: 3000
                });
            }
        });
    }
}
