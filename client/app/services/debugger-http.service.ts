import {Injectable} from "@angular/core";
import { DebugId } from "../models/DebugInfo";
import { SourceFunction, SourceFunctionId } from "../models/SourceFunction";
import { SpiceError } from "../models/SpiceError";
import { Http } from "@angular/http";
import { SourceVariable } from "../models/SourceVariable";
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
			if(err instanceof InvalidTypeError) {
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
			.map((res: any) => {
				return DebuggerState.fromObjectStrict(res.json(), this);
			})
			.catch(DebuggerHttpService.handleServerDataError('DebuggerState')).share();
	}

	public attachProcess(pid: number): Observable<DebuggerState> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/attach/pid/${pid}`, undefined)
			.map((res: any) => {
				return DebuggerState.fromObjectStrict(res.json(), this);
			})
			.catch(DebuggerHttpService.handleServerDataError('DebuggerState')).share();
	}

	/**
	 * Processes
	 */
	public getProcesses(): Observable<Process[]> {
		return this.http.get(`http://${host}:${port}/api/v1/processes`)
			.map((res: any) => {
				return res.json().map((p: any) => p as Process);
			})
			.catch(DebuggerHttpService.handleServerDataError('Process')).share();
	}

	/**
	 * Functions
	 */
	public getSourceFunctions(id: DebugId): Observable<SourceFunction[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions`)
			.map((res: any) => {
				let data = res.json();
				return data.map((sf: any) => sf as SourceFunction);
			})
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction')).share();
	}

	public getSourceFunction(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions/${sourceFunctionId}`)
			.map((res: any) => {
				return res.json() as SourceFunction;
			})
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction')).share();
	}

	public executeFunction(id: DebugId, sourceFunctionId: SourceFunctionId, parameters: {[id: string]: any}): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/functions/${sourceFunctionId}/execute`,
			{parameters: Object.keys(parameters).map(k => parseInt(parameters[k]))})
			.map((res: any) => {
				return res.json() as Execution;
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}

	/**
	 * Breakpoints
	 */
	public getBreakpoints(id: DebugId): Observable<Breakpoint[]> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/breakpoints`)
			.map((res: any) => {
				let data = res.json();
				return data.map((b: any) => b as Breakpoint);
			})
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint')).share();
	}

	public setBreakpoint(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<Breakpoint> {
		return this.http.put(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sourceFunctionId}`, undefined)
			.map((res: any) => {
				return res.json() as Breakpoint;
			})
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint')).share();
	}

	public removeBreakpoint(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<boolean> {
		return this.http.delete(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sourceFunctionId}`)
			.map((res: any) => {
				return true;
			})
			.catch(DebuggerHttpService.handleServerDataError('NONE')).share();
	}

	/**
	 * Executions
	 */
	public executeBinary(id: DebugId, args: string, environmentVars: string): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/execute`, {args: args, env: environmentVars})
			.map((res: any) => {
				return res.json() as Execution;
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}

	public getExecution(id: DebugId, executionId: ExecutionId): Observable<Execution> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}`)
			.map((res: any) => {
				return res.json() as Execution;
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}

	public getTrace(id: DebugId, executionId: ExecutionId): Observable<Trace> {
		return Observable.create((observer: Subscriber<Trace>) => {
			oboe({
					url: `http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}/trace`,
					method: 'GET'})
				.node('{index line data}', (t:any) => {
					try {
						observer.next(t as Trace);
						if(['return', 'break', 'exit', 'crash', 'error'].indexOf(t.data.tType) > -1) {
							observer.complete();
						}
					}
					catch(e) {
						observer.error(DebuggerHttpService.handleServerDataError('Trace')(e));
					}
				});
		}).share();

		//return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}/trace`)
			//.switchMap((res: any) => {
				//let data = res.text();
				//SpiceValidator.assertArrayStrict(data);

				//return Observable.from(data.map((t:any) => TraceFactory.fromObjectStrict(t)));
			//})
			//.catch(DebuggerHttpService.handleServerDataError('Trace')).share();
	}
}
