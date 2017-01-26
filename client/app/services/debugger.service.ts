import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";

@Injectable()
export class DebuggerService {
	public debuggerStates: { [id:string]: DebuggerState};
	public constructor() {
	}

	public attachBinary(path: string): Observable<DebuggerState> {
		let ds = new DebuggerState('0');
		this.debuggerStates['0'] = ds;
		return ds.initialize().map(()=> ds);
	}
}
