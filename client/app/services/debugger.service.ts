import {Injectable} from "@angular/core";
import { DebuggerState } from "../models/DebuggerState";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "./debugger-http.service";

@Injectable()
export class DebuggerService {
	public debuggerStates: { [id:string]: DebuggerState};
	public constructor(private debuggerHttp: DebuggerHttpService) {
	}

	public attachBinary(path: string): Observable<DebuggerState> {
		let ds = new DebuggerState('0', this.debuggerHttp);
		this.debuggerStates['0'] = ds;
		return ds.initialize().map(()=> ds);
	}
}
