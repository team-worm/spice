import {Injectable} from "@angular/core";
import { DebugId } from "../models/DebugId";
import { SourceFunctionId } from "../models/SourceFunctionId";
import { SourceFunction } from "../models/SourceFunction";
import { SpiceError } from "../models/errors/SpiceError";
import { Http } from "@angular/http";
import { SourceVariable } from "../models/SourceVariable";
import { InvalidServerDataError, InvalidTypeError } from "../models/errors/Errors";
import { Observable } from "rxjs/Observable";
import { DebuggerState } from "../models/DebuggerState";
import { Execution } from "../models/execution/Execution";
import { ExecutionFactory } from "../models/execution/ExecutionFactory";
import { Breakpoint } from "../models/Breakpoint";
import { ExecutionId } from "../models/execution/ExecutionId";
import { Trace } from "../models/trace/Trace";
import { TraceFactory } from "../models/trace/TraceFactory";
import { SpiceValidator } from "../util/SpiceValidator";
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

	public attachProcess(pid: string): Observable<DebuggerState> {
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
				return res.json().map((p: any) => Process.fromObjectStrict(p));
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
				SpiceValidator.assertArrayStrict(data);

				return (<any[]>data).map(sf => SourceFunction.fromObjectStrict(sf));
			})
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction')).share();
	}

	public getSourceFunction(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/functions/${sourceFunctionId}`)
			.map((res: any) => {
				return SourceFunction.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError('SourceFunction')).share();
	}

	public executeFunction(id: DebugId, sourceFunctionId: SourceFunctionId, parameters: {[id: string]: any}): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/functions/${sourceFunctionId}/execute`,
			{parameters: Object.keys(parameters).map(k => parseInt(parameters[k]))})
			.map((res: any) => {
				return ExecutionFactory.fromObjectStrict(res.json());
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
				SpiceValidator.assertArrayStrict(data);

				return (<any[]>data).map(b => Breakpoint.fromObjectStrict(b));
			})
			.catch(DebuggerHttpService.handleServerDataError('Breakpoint')).share();
	}

	public setBreakpoint(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<Breakpoint> {
		return this.http.put(`http://${host}:${port}/api/v1/debug/${id}/breakpoints/${sourceFunctionId}`, undefined)
			.map((res: any) => {
				return Breakpoint.fromObjectStrict(res.json());
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
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}

	public getExecution(id: DebugId, executionId: ExecutionId): Observable<Execution> {
		return this.http.get(`http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}`)
			.map((res: any) => {
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}

	public getTrace(id: DebugId, executionId: ExecutionId): Observable<Trace> {
		return Observable.create((observer: Subscriber<Trace>) => {
			oboe({
					url: `http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}/trace`,
					method: 'GET'})
				.node('{index tType line data}', (t:any) => {
					try {
						observer.next(TraceFactory.fromObjectStrict(t));
						if(t.tType === 2) {
							observer.complete();
						}
					}
					catch(e) {
						observer.error(DebuggerHttpService.handleServerDataError('Trace')(e));
					}
				});
		}).share();
	}

	public stopExecution(id: DebugId, executionId: ExecutionId): Observable<Execution> {
		return this.http.post(`http://${host}:${port}/api/v1/debug/${id}/executions/${executionId}/stop`, undefined)
			.map((res: any) => {
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError('Execution')).share();
	}
}
