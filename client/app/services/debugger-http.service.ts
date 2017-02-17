import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { DebugInfo, DebugId } from "../models/DebugInfo";
import { SourceFunction, SourceFunctionId } from "../models/SourceFunction";
import { SpiceError } from "../models/SpiceError";
import { SourceVariable } from "../models/SourceVariable";
import { fromJSON } from "../util/SpiceValidator";
import { InvalidServerDataError, InvalidTypeError } from "../models/Errors";
import { Observable } from "rxjs/Observable";
import { DebuggerState } from "../models/DebuggerState";
import { Execution, ExecutionId } from "../models/Execution";
import { Breakpoint } from "../models/Breakpoint";
import { Trace } from "../models/Trace";
import { Subscriber } from "rxjs/Subscriber";
import { Process } from "../models/Process";

const host:string = 'localhost';
const port:number = 3000;

declare var oboe: any;

@Injectable()
export class DebuggerHttpService {

	constructor(private http: Http) {
	}

	private static handleServerDataError(typeName: string) {
		return (err: any) => {
			if (err instanceof TypeError) {
				return Observable.throw(new InvalidServerDataError(typeName, err));
			}

			return Observable.throw(err);
		}
	}

	/**
	 * Debugger State
	 */
	public attachBinary(path: string): Observable<DebuggerState> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/attach/bin/${path}`, undefined)
			.map(res => fromJSON(res.json(), DebugInfo))
			.map((info: DebugInfo) => new DebuggerState(info, this))
			.catch(DebuggerHttpService.handleServerDataError('DebuggerState'))
			.share();
	}

	public attachProcess(pid: number): Observable<DebuggerState> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/attach/pid/${pid}`, undefined)
			.map(res => fromJSON(res.json(), DebugInfo))
			.map((info: DebugInfo) => new DebuggerState(info, this))
			.catch(DebuggerHttpService.handleServerDataError('DebuggerState'))
			.share();
	}

	/**
	 * Processes
	 */
	public getProcesses(): Observable<Process[]> {
		return this.http.get(`http://${host}:${port}/api/v1/processes`)
			.map(res => res.json().map((json: any) => fromJSON(json, Process)))
			.catch(DebuggerHttpService.handleServerDataError('Process'))
			.share();
	}

	/**
	 * Functions
	 */
	public getSourceFunctions(id: DebugId): Observable<SourceFunction[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions`)
			.map(res => res.json().map((json: any) => fromJSON(json, SourceFunction)))
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction'))
			.share();
	}

	public getSourceFunction(id: DebugId, sFunction: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions/${sFunction}`)
			.map(res => fromJSON(res.json(), SourceFunction))
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction'))
			.share();
	}

	public executeFunction(id: DebugId, sFunction: SourceFunctionId, parameters: {[id: string]: any}): Observable<Execution> {
		return this.http.post(
			`http://${host}:${port}/api/v1/debug/${id}/functions/${sFunction}/execute`,
			{parameters: Object.keys(parameters).map(k => parseInt(parameters[k]))}
		)
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.share();
	}

	/**
	 * Breakpoints
	 */
	public getBreakpoints(id: DebugId): Observable<Breakpoint[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/breakpoints`)
			.map(res => res.json().map((json: any) => fromJSON(json, Breakpoint)))
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint'))
			.share();
	}

	public setBreakpoint(id: DebugId, sFunction: SourceFunctionId): Observable<Breakpoint> {
		return this.http.put(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sFunction}`, undefined)
			.map((res: Response) => fromJSON(res.json(), Breakpoint))
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint'))
			.share();
	}

	public removeBreakpoint(id: DebugId, sFunction: SourceFunctionId): Observable<boolean> {
		return this.http.delete(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sFunction}`)
			.map(res => true)
			.catch(DebuggerHttpService.handleServerDataError('NONE'))
			.share();
	}

	/**
	 * Executions
	 */
	public executeBinary(id: DebugId, args: string, env: string): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/execute`, { args, env })
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.share();
	}

	public getExecution(id: DebugId, execution: ExecutionId): Observable<Execution> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/executions/${execution}`)
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.share();
	}

	public getTrace(id: DebugId, execution: ExecutionId): Observable<Trace> {
		return Observable.create((observer: Subscriber<Trace>) => {
			oboe({
				url: `http://${host}:${port}/api/v1/debug/${id}/executions/${execution}/trace`,
				method: 'GET'
			}).node('{index line data}', (t: any) => {
				try {
					observer.next(fromJSON(t, Trace) as Trace);
					if (['return', 'break', 'exit', 'crash', 'error'].indexOf(t.data.tType) > -1) {
						observer.complete();
					}
				} catch(e) {
					observer.error(DebuggerHttpService.handleServerDataError('Trace')(e));
				}
			});
		}).share();
	}
}
