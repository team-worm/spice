import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "./debugger-http.service";
import { DebugInfo, DebugId } from "../models/DebugInfo";
import { Process } from "../models/Process";
import { Execution } from "../models/Execution";
import { Observer } from "rxjs/Observer";
import { Trace, BreakData } from "../models/Trace";

export type DebuggerEvent = AttachEvent | DetachEvent | ExecutionEvent | ProcessEndedEvent;

export interface AttachEvent {
	eType: 'attach';
	debuggerState: DebuggerState;
	keepBreakpoints: boolean;
}

export interface DetachEvent {
	eType: 'detach';
}

export interface ExecutionEvent {
	eType: 'execution';
	execution: Execution | null;
	reason: 'break' | 'exit' | 'cancel' | 'crash' | 'error';
}

export interface ProcessEndedEvent {
	eType: 'processEnded';
	reason: 'exit' | 'crash' | 'error' | 'kill';
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
		this.debuggerEvents.subscribe(
			(event: DebuggerEvent) => console.log(event),
			(err) => console.error(err));
	}
	
	public getEventStream(eventTypes: string[]): Observable<DebuggerEvent> {
		return this.debuggerEvents.filter((event: DebuggerEvent) => eventTypes.indexOf(event.eType) !== -1);
	}

	public attachBinary(path: string, name: string, keepBreakpoints: boolean): Observable<DebuggerState> {
		return this.debuggerHttp.attachBinary(path)
			.switchMap(ds => {
				this.onAttach(ds, name, keepBreakpoints);
				return ds.initialize().map(()=> ds);
			});
	}

	public attachProcess(pid: number, name: string, keepBreakpoints: boolean): Observable<DebuggerState> {
		return this.debuggerHttp.attachProcess(pid)
			.switchMap(ds => {
				this.onAttach(ds, name, keepBreakpoints);
				return ds.initialize().map(()=> ds);
			});
	}

    public continueExecution(args: string = '', env: string = ''): Observable<Trace> {
		return this.currentDebuggerState!.executeBinary(args, env)
			.mergeMap((ex: Execution) => {
				return this.currentDebuggerState!.ensureTrace(ex.id);
			}).mergeMap((t: Observable<Trace>) => {
				return t;
			}).map((t: Trace) => {
				switch (t.data.tType) {
					case 'break':
						this.currentDebuggerState!.ensureExecutions([t.data.nextExecution])
							.subscribe((exMap) => {
								let ex = exMap.get((t.data as BreakData).nextExecution)!;
								this.debuggerEventsObserver.next({eType: 'execution', execution: ex, reason: 'break'});
							});
					break;
					case 'crash':
					case 'exit':
					case 'error':
						this.debuggerEventsObserver.next({eType: 'processEnded', reason: t.data.tType});
					break;
				}
				return t;
			});
	}

	public killProcess(): Observable<null> {
		return this.currentDebuggerState!.killProcess()
			.map(() => {
				this.currentExecution = null;
				this.debuggerEventsObserver.next({eType: 'processEnded', reason: 'kill'});
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

	protected onAttach(ds: DebuggerState, name: string, keepBreakpoints: boolean) {
		ds.name = name;
		this.debuggerStates.set(ds.info.id, ds);
		this.currentDebuggerState = ds;
		//ds.ensureAllSourceFunctions()
			//.subscribe(sfs => { this.debuggerEventsObserver.next({eType: 'attach', debuggerState: ds, keepBreakpoints: keepBreakpoints}); });
		console.log(this.debuggerEventsObserver);
		this.debuggerEventsObserver.next({eType: 'attach', debuggerState: ds, keepBreakpoints: keepBreakpoints});
	}

	public getProcesses(): Observable<Process[]> {
		return this.debuggerHttp.getProcesses();
	}

	public detach() {
		this.currentDebuggerState = null;
		this.debuggerEventsObserver.next({eType: 'detach'});
	}
}
