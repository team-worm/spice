import {Component, OnInit, ViewChild} from "@angular/core";
import {Http, Response} from "@angular/http";
import {MdDialog, MdSnackBar} from "@angular/material";
import {SourceFunction, SourceFunctionId } from "../../models/SourceFunction";
import {DebuggerService, AttachEvent, DisplayFunctionEvent } from "../../services/debugger.service";
import {DebuggerState} from "../../models/DebuggerState";
import {Breakpoint} from "../../models/Breakpoint";
import {ViewService} from "../../services/view.service";
import {FileSystemService} from "../../services/file-system.service";
import {MatchMaxHeightDirective} from "../../directives/MatchMaxHeight.directive";
import {FunctionListComponent} from "../common/function-list.component";
import {fromJSON} from "../../util/SpiceValidator";
import {SourceFunctionCollection} from "../../models/SourceFunctionCollection";
import { Observable } from "rxjs/Observable";
import * as Prism from 'prismjs';

import cRuntime from "./cRuntime";
import cStandardLib from "./cStandardLib";
import {TypeMappingComponent} from "../common/type-mapping.component";
import { displaySnackbarError } from "../../util/SnackbarError";

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

	constructor(public debuggerService: DebuggerService,
				private snackBar: MdSnackBar,
				private viewService: ViewService,
				private fileSystemService: FileSystemService,
				private http: Http,
                private dialog: MdDialog) {
		this.debuggerService.getEventStream(['attach']).subscribe((event: AttachEvent) => this.onAttach(event));
		this.debuggerService.getEventStream(['displayFunction']).subscribe((event: DisplayFunctionEvent) => this.onDisplayFunction(event));
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

    public OpenSpiceTypeDialog() {
	    if(this.selectedFunction) {
            this.dialog.open(TypeMappingComponent, {
                data: this.selectedFunction
            });
        }
    }

    public ExecuteBinary() {
    	this.debuggerService.continueExecution();
    }

    public HasBreakpoint(line: number): boolean {
    	if(!this.debuggerService.currentDebuggerState || !this.selectedFunction) {
    		return false;
		}
		for (let breakpoint of this.debuggerService.currentDebuggerState.breakpoints.values()) {
			let breakpointFunction = this.debuggerService.currentDebuggerState.sourceFunctions.get(breakpoint.sFunction)!;
			if(breakpointFunction.sourcePath === this.selectedFunction.sourcePath && breakpointFunction.lineStart === line) {
				return true;
			}
		}
		return false;
	}

    public loadSourceFunctions() {
		this.coreSourceFunctions = Array.from(this.debuggerService.currentDebuggerState!.sourceFunctions.values());
		if(this.selectedFunction && this.debuggerService.currentDebuggerState!.sourceFunctions.has(this.selectedFunction.address)) {
			this.selectedFunction = this.debuggerService.currentDebuggerState!.sourceFunctions.get(this.selectedFunction.address) || null;
		}
		else {
			this.selectedFunction = null;
		}
		this.filterListedFunctions();
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
            this.lines = this.lines.map(function(l) {
                return Prism.highlight(l, Prism.languages["clike"]);
            });
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

    public GetSelectedFunctionAsString():string {
        if(this.selectedFunction && this.debuggerService.currentDebuggerState && this.debuggerService.currentDebuggerState.sourceTypes) {
            let stMap = this.debuggerService.currentDebuggerState.sourceTypes;
            const parameters = this.selectedFunction.parameters
                .map(parameter => `${stMap.get(parameter.sType)!.toString(stMap)} ${parameter.name}`)
                .join(", ");
            return  `${this.selectedFunction.name}(${parameters})`;
        } else {
            return 'none';
        }
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
		if(this.selectedFunction) {
			this.debuggerService.preCallFunction(this.selectedFunction);
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
				displaySnackbarError(this.snackBar, 'Failed to add breakpoint', error);
		});
	}

	private removeBreakpoint(ds: DebuggerState, id: SourceFunctionId) {
		ds.removeBreakpoint(id).subscribe(
			() => {},
			(error: any) => {
				displaySnackbarError(this.snackBar, 'Failed to remove breakpoint', error);
		});
	}

	protected onAttach(event: AttachEvent) {
		this.loadSourceFunctions();
	}

	protected onDisplayFunction(event: DisplayFunctionEvent) {
		if(event.sourceFunction) {
			this.OnFunctionSelected(event.sourceFunction);
		}
	}
}
