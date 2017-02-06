import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "./debugger-http.service";
import { CacheMap } from "../util/CacheMap";
import { DebugId } from "../models/DebugId";

@Injectable()
export class DebuggerService {
	protected currentDebuggerState: DebuggerState | null;
	protected debuggerStates: CacheMap<Observable<DebuggerState>>;



	constructor(private debuggerHttp: DebuggerHttpService) {
		this.debuggerStates = new CacheMap<Observable<DebuggerState>>();
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
			let ds = new DebuggerState(id, this.debuggerHttp);
			this.debuggerStates.set(id, Observable.of(ds));
			return ds.initialize().map(()=> ds);
		}
	}

	public attachBinary(path: string): Observable<DebuggerState> {
		let dsObservable = this.debuggerHttp.attachBinary(path)
			.switchMap(ds => {
				this.debuggerStates.set(ds.id, dsObservable);
				return ds.initialize().map(()=> ds);
			});
		return dsObservable;
	}
}
