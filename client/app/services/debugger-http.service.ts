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

@Injectable()
export class DebuggerHttpService {
	constructor(private http: Http) {
	}

	private static handleServerDataError(err: any) {
		if(err instanceof InvalidTypeError) {
			return Observable.throw(new InvalidServerDataError('SourceFunction', err));
		}

		return Observable.throw(err);
	}

	/**
	 * Debugger State
	 */
	public attachBinary(path: string): Observable<DebuggerState> {
		return this.http.post(`/api/v1/debug/attach/bin/${path}`, undefined)
			.map(function(res: any) {
				return DebuggerState.fromObjectStrict(res.json(), this);
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	/**
	 * Functions
	 */
	public getFunctions(id: DebugId): Observable<SourceFunction[]> {
		return this.http.get(`/api/v1/debug/${id}/functions`)
			.map(function(res: any) {
				let data = res.json();
				SpiceValidator.assertArrayStrict(data);

				return (<any[]>data).map(sf => SourceFunction.fromObjectStrict(sf));
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public getFunction(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`/api/v1/debug/${id}/functions/${sourceFunctionId}`)
			.map(function(res: any) {
				return SourceFunction.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public executeFunction(id: DebugId, sourceFunctionId: SourceFunctionId, parameters: {[id: string]: any}): Observable<Execution> {
		return this.http.post(`/api/v1/debug/${id}/functions/${sourceFunctionId}/execute`, parameters)
			.map(function(res: any) {
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	/**
	 * Breakpoints
	 */
	public getBreakpoints(id: DebugId): Observable<Breakpoint[]> {
		return this.http.get(`/api/v1/debug/${id}/breakpoints`)
			.map(function(res: any) {
				let data = res.json();
				SpiceValidator.assertArrayStrict(data);

				return (<any[]>data).map(b => Breakpoint.fromObjectStrict(b));
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public setBreakpoint(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<Breakpoint[]> {
		return this.http.put(`/api/v1/debug/${id}/breakpoints/${sourceFunctionId}`, undefined)
			.map(function(res: any) {
				return Breakpoint.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	/**
	 * Executions
	 */
	public executeBinary(id: DebugId, args: string, environmentVars: string): Observable<Execution> {
		return this.http.post(`/api/v1/debug/${id}/execute`, undefined)
			.map(function(res: any) {
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public getExecution(id: DebugId, executionId: ExecutionId): Observable<Execution> {
		return this.http.get(`/api/v1/${id}/executions/${executionId}`)
			.map(function(res: any) {
				return ExecutionFactory.fromObjectStrict(res.json());
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public getTrace(id: DebugId, executionId: ExecutionId): Observable<Trace> {
		//TODO: make this read input as a stream
		return this.http.get(`/api/v1/${id}/executions/${executionId}`)
			.switchMap(function(res: any) {
				let data = res.json();
				SpiceValidator.assertArrayStrict(data);

				return Observable.from(data.map((t:any) => TraceFactory.fromObjectStrict(t)));
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}
}
