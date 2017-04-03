import {Component, OnInit, ViewChild} from "@angular/core";
import {Http, Response} from "@angular/http";
import {MdSnackBar} from "@angular/material";
import {SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {DebuggerService, AttachEvent } from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {Breakpoint} from "../../models/Breakpoint";
import {ViewService} from "../../services/view.service";
import {FileSystemService} from "../../services/file-system.service";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";
import {FunctionListComponent} from "../common/function-list.component";
import {fromJSON} from "../../util/SpiceValidator";
import {SourceFunctionCollection} from "../../models/SourceFunctionCollection";
import { Observable } from "rxjs/Observable";

import cRuntime from "./cRuntime";
import cStandardLib from "./cStandardLib";

@Component({
    moduleId: module.id,
    selector: 'spice-configuration',
    templateUrl: './functions.component.html'
})
export class FunctionsComponent implements OnInit {

    @ViewChild('FunctionsFunctionList') functionList:FunctionListComponent;

    public lines: string[] | null = null;
    public linesLoaded: boolean = true;
    public selectedFunction: SourceFunction | null = null;
    public listedFunctions: SourceFunction[] = [];
    public defaultFuncCollections: {collection: SourceFunctionCollection, doFilter: boolean}[] = [];

    private _functionsContentBody: HTMLElement | null;
    private coreSourceFunctions: SourceFunction[] = [];

	constructor(private debuggerService: DebuggerService,
				private snackBar: MdSnackBar,
				private viewService: ViewService,
				private fileSystemService: FileSystemService,
				private http: Http) {
		this.debuggerService.getEventStream(['attach']).subscribe((event: AttachEvent) => this.onAttach(event));
		//this.debuggerService.getEventStream(['detach']).subscribe(this.onDetach);
	}

    public ngOnInit() {
        this._functionsContentBody = document.getElementById('FunctionsContainer');
        if (!this._functionsContentBody) {
            console.error('Error getting FunctionsContainer');
        }

        this.defaultFuncCollections.push({
            collection: fromJSON(cRuntime, SourceFunctionCollection) as SourceFunctionCollection,
            doFilter: true,
        }, {
            collection: fromJSON(cStandardLib, SourceFunctionCollection) as SourceFunctionCollection,
            doFilter: true,
        });
        this.filterListedFunctions();
    }

    public ToggleBreakpoint() {
        if(this.selectedFunction) {
            if (this.debuggerService.currentDebuggerState!.breakpoints.has(this.selectedFunction.address)) {
                this.removeBreakpoint(this.debuggerService.currentDebuggerState!, this.selectedFunction.address);
            } else {
                this.addBreakpoint(this.debuggerService.currentDebuggerState!, this.selectedFunction.address);
            }
        } else {
            this.snackBar.open('No function selected.', undefined, {
                duration: 3000
            });
        }
    }

    public ExecuteBinary() {
    	this.debuggerService.continueExecution();
    }

    public HasBreakpoint(line: number): boolean {
		for (let breakpoint of this.debuggerService.currentDebuggerState!.breakpoints.values()) {
			let breakpointFunction = this.debuggerService.currentDebuggerState!.sourceFunctions.get(breakpoint.sFunction)!;
			if(breakpointFunction.sourcePath === this.selectedFunction!.sourcePath && breakpointFunction.lineStart === line) {
				return true;
			}
		}
		return false;
	}

    public loadSourceFunctions(): Observable<null> {
		return this.debuggerService.currentDebuggerState!.ensureAllSourceFunctions().map(sfMap => {
			this.coreSourceFunctions = Array.from(sfMap);
			this.filterListedFunctions();
			return null;
		},
		(error: any) => {
			console.log(error);
			this.snackBar.open('Error getting Source Functions', undefined, {
				duration: 3000
			});
		});
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

    public ExecuteFunction() {
        if (this.viewService.debuggerComponent) {
            this.viewService.debuggerComponent.setParameters = {};
            this.viewService.debuggerComponent.setSourceFunction(this.selectedFunction!);
            this.viewService.activeView = 'debugger';
        }
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

	private addBreakpoint(ds: DebuggerState, id: SourceFunctionId) {
		ds.setBreakpoint(id).subscribe(
			(bp: Breakpoint) => {},
			(error: any) => {
				console.log(error);
				this.snackBar.open(`Failed to add breakpoint: ${error.message}`, undefined, {
					duration: 3000
				});
		});
	}

	private removeBreakpoint(ds: DebuggerState, id: SourceFunctionId) {
		ds.removeBreakpoint(id).subscribe(
			() => {},
			(error: any) => {
				console.log(error);
				this.snackBar.open(`Failed to remove breakpoint: ${error.message}`, undefined, {
					duration: 3000
				});
		});
	}

	protected onAttach(event: AttachEvent) {
		this.loadSourceFunctions()
			.subscribe(() => {
			if(event.keepBreakpoints) {
			}
		});
	}
}
