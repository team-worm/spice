import {Injectable} from "@angular/core";
import {DebuggerState} from "../models/DebuggerState";
import {Observable} from "rxjs/Observable";
import {DebuggerHttpService} from "./debugger-http.service";
import {DebugId} from "../models/DebugInfo";
import {Process} from "../models/Process";
import {Execution} from "../models/Execution";
import {Observer} from "rxjs/Observer";
import {BreakData, Trace} from "../models/Trace";
import {SourceFunction} from "../models/SourceFunction";
import {Value} from "../models/Value";
import {SourceType, SourceTypeId} from "../models/SourceType";

export type DebuggerEvent = ErrorEvent | AttachEvent | DetachEvent | ExecutionEvent | ProcessEndedEvent | PreCallFunctionEvent | DisplayTraceEvent | DisplayFunctionEvent;

export interface ErrorEvent {
	eType: 'error';
	cause: string;
	error: any;
}

export interface AttachEvent {
	eType: 'attach';
	debuggerState: DebuggerState;
}

export interface DetachEvent {
	eType: 'detach';
}

export interface ExecutionEvent {
	eType: 'execution';
	execution: Execution | null;
	reason: 'continue' | 'call' | 'return' | 'break' | 'exit' | 'cancel' | 'crash' | 'error';
}

export interface ProcessEndedEvent {
	eType: 'processEnded';
	reason: 'exit' | 'crash' | 'error' | 'kill';
	lastDebuggerState: DebuggerState;
}

export interface PreCallFunctionEvent {
	eType: 'preCallFunction';
	sourceFunction: SourceFunction;
}

export interface DisplayTraceEvent {
	eType: 'displayTrace';
	execution: Execution;
}

export interface DisplayFunctionEvent {
	eType: 'displayFunction';
	sourceFunction: SourceFunction | null;
}

/** Debugger Service
 * Controls state and control flow that is used to control the debugger across
 * the entire app.
 *
 * The service exposes a global event observable (via getEventStream) that
 * other components should listen to, so they can react to events like
 * attaching/detaching from a process.
 *
 * Components that need to modify global state (e.g. attach, detach, start
 * execution) should do so through this service.
 *
 * Some components require more direct access global state, and should notify
 * other components of changes they make by calling the appropriate "event
 * dispatch" functions.
 */
@Injectable()
export class DebuggerService {
	public debuggerStates: Map<DebugId, DebuggerState>;
	public currentDebuggerState: DebuggerState | null = null;
	public currentExecution: Execution | null = null;

	public debuggerEvents: Observable<DebuggerEvent>;
	protected debuggerEventsObserver: Observer<DebuggerEvent>;


	constructor(private debuggerHttp: DebuggerHttpService) {
		this.debuggerStates = new Map<DebugId, DebuggerState>();
		this.debuggerEvents = Observable.create((observer: Observer<DebuggerEvent>) => {
			this.debuggerEventsObserver = observer;
		}).publishReplay().refCount();
		this.getEventStream(['processEnded']).subscribe((event: ProcessEndedEvent) => this.onProcessEnded(event));

		this.debuggerEvents.subscribe(
			(event: DebuggerEvent) => {/*console.log(event)*/},
			(err) => console.error(err));
	}
	
	/**
	 * Returns an observable which emits global events of the types listed in the input array
	 */
	public getEventStream(eventTypes: string[]): Observable<DebuggerEvent> {
		return this.debuggerEvents.filter((event: DebuggerEvent) => eventTypes.indexOf(event.eType) !== -1);
	}

	public attachBinary(path: string, name: string): Observable<DebuggerState> {
		return this.debuggerHttp.attachBinary(path)
			.switchMap(ds => {
				this.onAttach(ds, name, path, true);
				return ds.initialize().map(()=> ds);
			}).catch(DebuggerService.makeErrorHandler(this, 'Failed to attach to binary'));
	}

	public attachProcess(pid: number, name: string): Observable<DebuggerState> {
		return this.debuggerHttp.attachProcess(pid)
			.switchMap(ds => {
				this.onAttach(ds, name, '', false);
				return ds.initialize().map(()=> ds);
			}).catch(DebuggerService.makeErrorHandler(this, 'Failed to attach to process'));
	}

	/**
	 * Start/continue execution until we hit an endpoint or the application ends/crashes
	 */
    public continueExecution(args: string = '', env: string = ''): Observable<Trace> {
		return this.currentDebuggerState!.executeBinary(args, env)
			.mergeMap((ex: Execution) => {
				this.currentExecution = ex;
				this.debuggerEventsObserver.next({eType: 'execution', execution: ex, reason: 'continue'});
				return this.currentDebuggerState!.ensureTrace(ex.id);
			}).mergeMap((t: Observable<Trace>) => {
				return t;
			}).map((t: Trace) => {
				switch (t.data.tType) {
					case 'break':
						this.currentDebuggerState!.ensureExecutions([t.data.nextExecution])
							.subscribe((exMap) => {
								let ex = exMap.get((t.data as BreakData).nextExecution)!;
								this.currentExecution = ex;
								this.debuggerEventsObserver.next({eType: 'execution', execution: ex, reason: 'break'});
							});
					break;
                    case 'cancel':
                        this.executionStopped('cancel');
                    break;
					case 'exit':
						this.processEnded('exit');
						break;
					case 'crash':
						this.errorOccurred('crash', new Error(t.data.stack));
						this.processEnded(t.data.tType);
						break;
					case 'error':
						this.errorOccurred('error', t.data.error);
						this.processEnded(t.data.tType);
					break;
				}
				return t;
			}).catch(DebuggerService.makeErrorHandler(this, 'Failed to continue execution'));
	}

	public killProcess(): Observable<{}> {
		return this.currentDebuggerState!.killProcess()
			.map(() => {
				let lastDebuggerState = this.currentDebuggerState;
				this.currentDebuggerState = null;
				this.currentExecution = null;
				this.debuggerEventsObserver.next({eType: 'processEnded', reason: 'kill', lastDebuggerState: lastDebuggerState!});
			}).catch(DebuggerService.makeErrorHandler(this, 'Failed to kill process'));
	}

	/**
	 * Cancels the currently running exeuction
	 */
	public stopCurrentExecution(): Observable<{}> {
		return this.currentDebuggerState!.stopExecution(this.currentExecution!.id)
			.catch(DebuggerService.makeErrorHandler(this, 'Failed to stop execution'));
	}

    public executionStopped(reason: 'return' | 'cancel' | 'exit' | 'crash' | 'error') {
        this.currentExecution = null;
        this.debuggerEventsObserver.next({eType: 'execution', execution: null, reason: reason});
    }

	/**
	 * After we attach, load the program's function list and variable types
	 */
	protected onAttach(ds: DebuggerState, name: string, binaryPath: string, isBinary: boolean) {
		ds.name = name;
		ds.binaryPath = binaryPath;
		ds.isBinary = isBinary;
		ds.ensureAllSourceFunctions()
			.mergeMap(sfs => {
				if(sfs.length === 0) {
					return Observable.of(new Map<SourceTypeId, SourceType>());
				}
				return ds.ensureSourceTypes(Array.from(
					sfs.reduce((o, sf) => {
						sf.parameters.concat(sf.locals).forEach(sv => o.add(sv.sType));
						return o;
					}, new Set<number>()).values()));
			})
			.subscribe(sts => {
				this.debuggerStates.set(ds.info.id, ds);
				this.currentDebuggerState = ds;
				this.debuggerEventsObserver.next({eType: 'attach', debuggerState: ds});
			});
	}

	public getProcesses(): Observable<Process[]> {
		return this.debuggerHttp.getProcesses().catch(DebuggerService.makeErrorHandler(this, 'Failed to get processes'));
	}

	/**
	 * Kills program (without sending processEnded event), then detaches
	 */
	public detach(): Observable<{}> {
		return this.currentDebuggerState!.killProcess()
			.catch(DebuggerService.makeErrorHandler(this, 'Failed to kill process'))
			.catch(() => Observable.of({}))
			.map(() => {
				this.currentExecution = null;
				this.currentDebuggerState = null;
				this.debuggerEventsObserver.next({eType: 'detach'});
				return {};
			});
	}

	public callFunction(sourceFunction: SourceFunction, parameters: { [varId: number]: Value}): Observable<Execution> {
		return this.currentDebuggerState!.callFunction(sourceFunction.address, parameters)
			.map(ex => {
				this.currentExecution = ex;
				this.debuggerEventsObserver.next({eType: 'execution', execution: ex, reason: 'call'});
				return ex;
			}).catch(DebuggerService.makeErrorHandler(this, 'Failed to call function'));
	}

	public preCallFunction(sourceFunction: SourceFunction) {
		this.debuggerEventsObserver.next({eType: 'preCallFunction', sourceFunction: sourceFunction});
	}

	public displayTrace(execution: Execution) {
		this.debuggerEventsObserver.next({eType: 'displayTrace', execution: execution});
	}

	public displayFunction(sourceFunction: SourceFunction | null) {
		this.debuggerEventsObserver.next({eType: 'displayFunction', sourceFunction: sourceFunction});
	}

	public processEnded(reason: 'exit' | 'crash' | 'error' | 'kill') {
		let lastDebuggerState = this.currentDebuggerState;
		this.currentDebuggerState = null;
		this.currentExecution = null;
		this.debuggerEventsObserver.next({eType: 'processEnded', reason: reason, lastDebuggerState: lastDebuggerState!});
	}

	public errorOccurred(cause: string, error: any) {
		this.debuggerEventsObserver.next({eType: 'error', cause: cause, error: error});
	}

	/**
	 * When the process ends, automatically reattach so the user can immediately re-run code
	 */
	protected onProcessEnded(event: ProcessEndedEvent) {
		if(!event.lastDebuggerState.isBinary) {
			//TODO: do something when attached process ends (vs launched binary)
			return;
		}

		this.debuggerHttp.attachBinary(event.lastDebuggerState.binaryPath)
			.subscribe(
				ds => {
					Observable.forkJoin(Array.from(event.lastDebuggerState.breakpoints.keys()).map(bId => ds.setBreakpoint(bId))).defaultIfEmpty([])
						.subscribe(
							() => {
								this.onAttach(ds, event.lastDebuggerState.name, event.lastDebuggerState.binaryPath, event.lastDebuggerState.isBinary);
							},
							(err) => {console.error(`Failed to set breakpoint ${err}`);});
				},
				err => { console.error(`Failed to reattach to binary: ${err}`); });
	}

	protected static makeErrorHandler(ds: DebuggerService, cause: string) {
		return function(err: any) {
			ds.debuggerEventsObserver.next({eType: 'error', cause: cause, error: err});
			throw err;
		}
	}
}
