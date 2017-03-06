import {Component, OnInit, ViewChild} from "@angular/core";
import {Http, Response} from "@angular/http";
import {MdSnackBar} from "@angular/material";
import {SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {DebuggerService} from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {Breakpoint} from "../../models/Breakpoint";
import {ViewService} from "../../services/view.service";
import {FileSystemService} from "../../services/file-system.service";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";
import {FunctionListComponent} from "../common/function-list.component";
import {fromJSON} from "../../util/SpiceValidator";
import {SourceFunctionCollection} from "../../models/SourceFunctionCollection";

@Component({
    moduleId: module.id,
    selector: 'spice-configuration',
    templateUrl: './functions.component.html'
})
export class FunctionsComponent implements OnInit {

    @ViewChild('FunctionsFunctionList') functionList:FunctionListComponent;

    public lines: string[] | null;
    public linesLoaded: boolean = true;
    public selectedFunction: SourceFunction | null;
    public debugState: DebuggerState | null;
    public listedFunctions: SourceFunction[];
    public defaultFuncCollections: {collection: SourceFunctionCollection, doFilter: boolean}[];

    private _functionsContentBody: HTMLElement | null;
    private coreSourceFunctions: SourceFunction[];

    constructor(private debuggerService: DebuggerService,
                private snackBar: MdSnackBar,
                private viewService: ViewService,
                private fileSystemService: FileSystemService,
                private http: Http) {
        this.selectedFunction = null;
        this.debugState = null;
        this.lines = null;
        this.listedFunctions = [];
        this.defaultFuncCollections = [];

        this.coreSourceFunctions = [];
    }

    public ngOnInit() {
        this._functionsContentBody = document.getElementById('FunctionsContainer');
        if (!this._functionsContentBody) {
            console.error('Error getting FunctionsContainer');
        }
        this.loadFunctionCollection(`app/components/functions/cRuntime.json`);
        this.loadFunctionCollection(`app/components/functions/cStandardLib.json`);
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
        let ds: DebuggerState|null;
        if (ds = this.debuggerService.getCurrentDebuggerState()) {
            this.debugState = ds;
            ds.getSourceFunctions().subscribe({
                next: (sfMap: {[id: string]: SourceFunction}) => {
                    this.coreSourceFunctions = Object.keys(sfMap).map((key: string) => {
                        return sfMap[key]
                    });
                    this.filterListedFunctions();
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
        if(this.functionList) {
            /* Redundantly sets the list in case OnFunctionSelected is called outside of this component. */
            this.functionList.selectedFunction = $event;
        }

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


    public refreshHeights(): void {
        if(!!this.lines) {
            this.lines.forEach((l,i) => MatchMaxHeightDirective.markDirty('functions-'+i.toString()));
        }
    }

    public GetSelectedFunctionAsString(): string {
        return this.selectedFunction ? this.selectedFunction.getAsStringWithParameters(' ') : 'none';
    }

    public GetFullCardHeight(): number {

        if (!this._functionsContentBody) {
            return 50;
        }
        return (window.innerHeight - this._functionsContentBody.offsetTop) - 130;

    }

    public GetListHeight(): number {
        return this.GetFullCardHeight() - 62;
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

    public ToggleFilter(filter: {collection: SourceFunctionCollection, doFilter: boolean}) {
        filter.doFilter = !filter.doFilter;
        this.filterListedFunctions();
    }

    private filterListedFunctions() {
        this.listedFunctions = this.coreSourceFunctions.filter((sf:SourceFunction)=> {
            let activeFilters = this.defaultFuncCollections.filter((item)=> {
                return item.doFilter;
            });

            for(let i = 0; i < activeFilters.length; i++) {
                let filter = activeFilters[i];
                if(filter.collection.functionNames.indexOf(sf.name) !== -1) {
                    return false;
                }
            }
            return true;
        });
    }

    private loadFunctionCollection(path:string) {
        this.http.get(path).subscribe((dat:Response)=> {
            this.defaultFuncCollections.push({
                collection: <SourceFunctionCollection>fromJSON(dat.json(), SourceFunctionCollection),
                doFilter: true
            });
            this.filterListedFunctions();
        },(err:any)=> {
            console.log(err);
        })
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
