import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "./debugger-http.service";
import { DebugInfo, DebugId } from "../models/DebugInfo";
import { Process } from "../models/Process";
import { Execution } from "../models/Execution";
import { Observer } from "rxjs/Observer";
import { Trace, BreakData } from "../models/Trace";
import { SourceFunction } from "../models/SourceFunction";
import { Value } from "../models/Value";

export type DebuggerEvent = AttachEvent | DetachEvent | ExecutionEvent | ProcessEndedEvent | PreCallFunctionEvent | DisplayTraceEvent | DisplayFunctionEvent;

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
	reason: 'continue' | 'call' | 'break' | 'exit' | 'cancel' | 'crash' | 'error';
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

@Injectable()
export class DebuggerService {
	public currentDebuggerState: DebuggerState | null = null;
	public debuggerStates: Map<DebugId, DebuggerState>;

	public debuggerEvents: Observable<DebuggerEvent>;
	protected debuggerEventsObserver: Observer<DebuggerEvent>;
	public currentExecution: Execution | null = null;


	constructor(private debuggerHttp: DebuggerHttpService) {
		this.debuggerStates = new Map<DebugId, DebuggerState>();
		this.debuggerEvents = Observable.create((observer: Observer<DebuggerEvent>) => {
			this.debuggerEventsObserver = observer;
		}).publishReplay().refCount();
		this.getEventStream(['processEnded']).subscribe((event: ProcessEndedEvent) => this.onProcessEnded(event));
		this.debuggerEvents.subscribe(
			(event: DebuggerEvent) => console.log(event),
			(err) => console.error(err));
	}
	
	public getEventStream(eventTypes: string[]): Observable<DebuggerEvent> {
		return this.debuggerEvents.filter((event: DebuggerEvent) => eventTypes.indexOf(event.eType) !== -1);
	}

	public attachBinary(path: string, name: string): Observable<DebuggerState> {
		return this.debuggerHttp.attachBinary(path)
			.switchMap(ds => {
				this.onAttach(ds, name, path, true);
				return ds.initialize().map(()=> ds);
			});
	}

	public attachProcess(pid: number, name: string): Observable<DebuggerState> {
		return this.debuggerHttp.attachProcess(pid)
			.switchMap(ds => {
				this.onAttach(ds, name, '', false);
				return ds.initialize().map(()=> ds);
			});
	}

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
					case 'crash':
					case 'exit':
					case 'error':
						let lastDebuggerState = this.currentDebuggerState;
						this.currentDebuggerState = null;
						this.currentExecution = null;
						this.debuggerEventsObserver.next({eType: 'processEnded', reason: t.data.tType, lastDebuggerState: lastDebuggerState!});
					break;
				}
				return t;
			});
	}

	public killProcess(): Observable<null> {
		return this.currentDebuggerState!.killProcess()
			.map(() => {
				let lastDebuggerState = this.currentDebuggerState;
				this.currentDebuggerState = null;
				this.currentExecution = null;
				this.debuggerEventsObserver.next({eType: 'processEnded', reason: 'kill', lastDebuggerState: lastDebuggerState!});
				return null;
			});
	}

	public stopCurrentExecution(): Observable<null> {
		return this.currentDebuggerState!.stopExecution(this.currentExecution!.id)
			.map(() => {
				this.currentExecution = null;
				this.debuggerEventsObserver.next({eType: 'execution', execution: null, reason: 'cancel'});
				return null;
			});
	}

	protected onAttach(ds: DebuggerState, name: string, binaryPath: string, isBinary: boolean) {
		ds.name = name;
		ds.binaryPath = binaryPath;
		ds.isBinary = isBinary;
		ds.ensureAllSourceFunctions()
			.subscribe(sfs => {
				this.debuggerStates.set(ds.info.id, ds);
				this.currentDebuggerState = ds;
				this.debuggerEventsObserver.next({eType: 'attach', debuggerState: ds});
			});
	}

	public getProcesses(): Observable<Process[]> {
		return this.debuggerHttp.getProcesses();
	}

	//kills (without sending processEnded event), then detaches
	public detach(): Observable<null> {
		return this.currentDebuggerState!.killProcess()
			.map(() => {
				this.currentExecution = null;
				this.currentDebuggerState = null;
				this.debuggerEventsObserver.next({eType: 'detach'});
				return null;
			});
	}

	public callFunction(sourceFunction: SourceFunction, parameters: { [varId: number]: Value}): Observable<Execution> {
		return this.currentDebuggerState!.executeFunction(sourceFunction.address, parameters)
			.map(ex => {
				this.currentExecution = ex;
				this.debuggerEventsObserver.next({eType: 'execution', execution: ex, reason: 'call'});
				return ex;
			});
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
}
