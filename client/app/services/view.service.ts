import {Injectable} from "@angular/core";
import {DebuggerComponent} from "../components/debugger/debugger.component";
import { FunctionsComponent } from "../components/functions/functions.component";
import {LauncherComponent} from "../components/launcher/launcher.component";
import {ToolbarComponent} from "../components/toolbar/toolbar.component";
import {TraceHistoryComponent} from "../components/debugger/trace-history/trace-history.component";
import {SpiceRootComponent} from "../components/spice-root.component";
import { AttachEvent, DetachEvent, ExecutionEvent, DebuggerService, PreCallFunctionEvent, DisplayTraceEvent, DisplayFunctionEvent } from "./debugger.service";

@Injectable()
export class ViewService {

    private views:string[];

    private _activeView:string;

    public rootComponent: SpiceRootComponent | null;
    public toolbarComponent: ToolbarComponent | null;
    public launcherComponent: LauncherComponent | null;
    public functionsComponent: FunctionsComponent | null;
    public debuggerComponent: DebuggerComponent | null;
    public traceHistoryComponent: TraceHistoryComponent | null;

    constructor(private debuggerService: DebuggerService) {
        this.views = ['launcher','functions','debugger'];
		this._activeView = this.views[0];
		this.debuggerService.getEventStream(['attach']).subscribe((event: AttachEvent) => this.onAttach(event));
		this.debuggerService.getEventStream(['detach']).subscribe((event: DetachEvent) => this.onDetach(event));
		this.debuggerService.getEventStream(['execution']).subscribe((event: ExecutionEvent) => this.onExecution(event));
		this.debuggerService.getEventStream(['preCallFunction']).subscribe((event: PreCallFunctionEvent) => this.onPreCallFunction(event));
		this.debuggerService.getEventStream(['displayTrace']).subscribe((event: DisplayTraceEvent) => this.onDisplayTrace(event));
		this.debuggerService.getEventStream(['displayFunction']).subscribe((event: DisplayFunctionEvent) => this.onDisplayFunction(event));
    }

    get activeView() {
        return this._activeView;
    }

    set activeView(view:string) {
        let lwView = view.toLowerCase();

        switch(lwView) {
            case 'launcher':
                this._activeView = lwView;
                break;
            case 'functions':
                if(this.functionsViewAvailable) {
                    this._activeView = lwView;
                    return;
                }
                break;
            case 'debugger':
                if(this.debuggerViewAvailable) {
                    this._activeView = lwView;
                    return;
                }
                break;
            default:
                console.error('Attempt to set view to invalid value:', view);
        }
    }

    get functionsViewAvailable() {
        return (this.launcherComponent && this.launcherComponent.debugState);
    }

    get debuggerViewAvailable() {
        return (this.launcherComponent && this.launcherComponent.debugState); //TODO: make return vary based on app state.
    }

	public onAttach(event: AttachEvent) {
		//console.log('attached in view service');
		//this.activeView = 'functions';
		this._activeView = 'functions';
	}

	public onExecution(event: ExecutionEvent) {
		if(event.reason === 'break') {
			this._activeView = 'debugger';
		}
	}

	public onPreCallFunction(event: PreCallFunctionEvent) {
		this._activeView = 'debugger';
	}

	public onDetach(event: DetachEvent) {
		this._activeView = 'launcher';
	}

	public onDisplayTrace(event: DisplayTraceEvent) {
		this._activeView = 'debugger';
	}

	public onDisplayFunction(event: DisplayFunctionEvent) {
		this._activeView = 'functions';
	}
}
