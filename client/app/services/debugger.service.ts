import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "./debugger-http.service";
import { CacheMap } from "../util/CacheMap";
import { DebugInfo, DebugId } from "../models/DebugInfo";
import { Process } from "../models/Process";

@Injectable()
export class DebuggerService {
	protected currentDebuggerState: DebuggerState | null;
	protected debuggerStates: CacheMap<DebugId, Observable<DebuggerState>>;



	constructor(private debuggerHttp: DebuggerHttpService) {
		this.debuggerStates = new CacheMap<DebugId, Observable<DebuggerState>>();
		this.currentDebuggerState = null;
	}

	public getCurrentDebuggerState(): DebuggerState | null {
		return this.currentDebuggerState;
	}

	public setCurrentDebuggerState(state: DebuggerState | null): void {
		this.currentDebuggerState = state;
	}

	public getDebuggerState(id: DebugId): Observable<DebuggerState> {
		try {
			return this.debuggerStates.get(id);
		}
		catch(e) {
			let info = new DebugInfo();
			info.id = id;
			let ds = new DebuggerState(info, this.debuggerHttp);
			this.debuggerStates.set(id, Observable.of(ds));
			return ds.initialize().map(()=> ds);
		}
	}

	public attachBinary(path: string): Observable<DebuggerState> {
		let dsObservable = this.debuggerHttp.attachBinary(path)
			.switchMap(ds => {
				this.debuggerStates.set(ds.info.id, dsObservable);
				return ds.initialize().map(()=> ds);
			});
		return dsObservable;
	}

	public attachProcess(pid: number): Observable<DebuggerState> {
		let dsObservable = this.debuggerHttp.attachProcess(pid)
			.switchMap(ds => {
				this.debuggerStates.set(ds.info.id, dsObservable);
				return ds.initialize().map(()=> ds);
			});
		return dsObservable;
	}

	public getProcesses(): Observable<Process[]> {
		return this.debuggerHttp.getProcesses();
	}
}
