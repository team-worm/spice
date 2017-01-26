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

	public attachBinary(path: string): Observable<DebuggerState> {
		return this.http.post(`/api/v1/debug/attach/bin/${path}`, undefined)
			.map(function(res: any) {
				return DebuggerState.fromObjectStrict(res.json().data, this);
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public executeBinary(id: DebugId, args: string, environmentVars: string): Observable<Execution> {
		return this.http.post(`/api/v1/debug/${id}/execute`, undefined)
			.map(function(res: any) {
				return ExecutionFactory.fromObjectStrict(res.json().data);
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public getFunctions(id: DebugId): Observable<{[id: string]: SourceFunction}> {
		return this.http.get(`/api/v1/debug/${id}/functions`)
			.map(function(res: any) {
				let data = res.json().data;
				this.assertArrayStrict(data);

				return (<any[]>data).map(sf => SourceFunction.fromObjectStrict(sf))
					.reduce((o, sf) => { o[sf.id] = sf; return o; });
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}

	public getFunction(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`/api/v1/debug/${id}/functions/${sourceFunctionId}`)
			.map(function(res: any) {
				return SourceFunction.fromObjectStrict(res.json().data);
			})
			.catch(DebuggerHttpService.handleServerDataError);
	}
}
