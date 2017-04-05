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
import { Trace, LineData } from "../models/Trace";
import { Subscriber } from "rxjs/Subscriber";
import { Process } from "../models/Process";
import { Value } from "../models/Value";
import { SourceTypeId, SourceType } from "../models/SourceType";

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
			.publishLast().refCount();
	}

	public attachProcess(pid: number): Observable<DebuggerState> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/attach/pid/${pid}`, undefined)
			.map(res => fromJSON(res.json(), DebugInfo))
			.map((info: DebugInfo) => new DebuggerState(info, this))
			.catch(DebuggerHttpService.handleServerDataError('DebuggerState'))
			.publishLast().refCount();
	}

	/**
	 * Processes
	 */
	public getProcesses(): Observable<Process[]> {
		return this.http.get(`http://${host}:${port}/api/v1/processes`)
			.map(res => res.json().map((json: any) => fromJSON(json, Process)))
			.catch(DebuggerHttpService.handleServerDataError('Process'))
			.publishLast().refCount();
	}

	/**
	 * Functions
	 */
	public getSourceFunctions(id: DebugId): Observable<SourceFunction[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions`)
			.map(res => res.json().map((json: any) => fromJSON(json, SourceFunction)))
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction'))
			.publishLast().refCount();
	}

	public getSourceFunction(id: DebugId, sFunction: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions/${sFunction}`)
			.map(res => fromJSON(res.json(), SourceFunction))
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction'))
			.publishLast().refCount();
	}

	public executeFunction(id: DebugId, sFunction: SourceFunctionId, parameters: {[id: number]: Value}): Observable<Execution> {
		return this.http.post(
			`http://${host}:${port}/api/v1/debug/${id}/functions/${sFunction}/execute`,
			{arguments: parameters}
		)
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.publishLast().refCount();
	}

	/**
	 * Breakpoints
	 */
	public getBreakpoints(id: DebugId): Observable<Breakpoint[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/breakpoints`)
			.map(res => res.json().map((json: any) => fromJSON(json, Breakpoint)))
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint'))
			.publishLast().refCount();
	}

	public setBreakpoint(id: DebugId, sFunction: SourceFunctionId): Observable<Breakpoint> {
		return this.http.put(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sFunction}`, undefined)
			.map((res: Response) => fromJSON(res.json(), Breakpoint))
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint'))
			.publishLast().refCount();
	}

	public removeBreakpoint(id: DebugId, sFunction: SourceFunctionId): Observable<boolean> {
		return this.http.delete(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sFunction}`)
			.map(res => true)
			.catch(DebuggerHttpService.handleServerDataError('NONE'))
			.publishLast().refCount();
	}

	/**
	 * Executions
	 */
	public executeBinary(id: DebugId, args: string, env: string): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/execute`, { args, env })
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.publishLast().refCount();
	}

	public getExecution(id: DebugId, execution: ExecutionId): Observable<Execution> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/executions/${execution}`)
			.map(res => fromJSON(res.json(), Execution))
			.catch(DebuggerHttpService.handleServerDataError('Execution'))
			.publishLast().refCount();
	}

	public getTrace(id: DebugId, execution: ExecutionId): Observable<Trace> {
		return Observable.create((observer: Subscriber<Trace>) => {
			oboe({
				url: `http://${host}:${port}/api/v1/debug/${id}/executions/${execution}/trace`,
				method: 'GET'
			}).node('{index line data}', (t: any) => {
				try {
					//insert the 'value' field we need for the typing system to work
					let trace = fromJSON(t, Trace) as Trace;
					if(trace.data.tType === 'line') {
						trace.data.state = Object.keys(trace.data.state).reduce((o, s) => { o[s] = {value: (trace.data as LineData).state[s]}; return o;}, {});
					}
					observer.next(trace);
					if (['return', 'break', 'exit', 'crash', 'error'].indexOf(t.data.tType) > -1) {
						observer.complete();
					}
				} catch(e) {
					observer.error(DebuggerHttpService.handleServerDataError('Trace')(e));
				}
			}).fail((thrown: any, statusCode: number, body: any, jsonBody: any) => {
				observer.error(new Error(`GetTrace failed: ${thrown || {status: statusCode}}`));
			});
		}).publishReplay().refCount();
	}

	public stopExecution(id: DebugId, executionId: ExecutionId): Observable<null> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}/stop`, undefined)
			.map(res => null)
			.publishLast().refCount();
	}
	public killProcess(id: DebugId): Observable<null> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/kill`, undefined)
            .map(res => null)
            .publishLast().refCount();
	}

	public getSourceTypes(id: DebugId, typeIds: SourceTypeId[]): Observable<{[id: number]: SourceType}> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/types?ids=${typeIds.join(',')}`)
			.map(res => {
				let data = res.json();
				return Object.keys(data).reduce((o, tId) => {
					o[tId] = fromJSON(data[tId], SourceType);
					return o;
				}, {})
			})
			.catch(DebuggerHttpService.handleServerDataError('SourceType'))
			.publishLast().refCount();
	}
}
