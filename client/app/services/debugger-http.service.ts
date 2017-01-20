import {Injectable} from "@angular/core";
import { DebugId } from "../models/DebugId";
import { SourceFunctionId } from "../models/SourceFunctionId";
import { SourceFunction } from "../models/SourceFunction";
import { SpiceError } from "../models/errors/SpiceError";
import { Http } from "@angular/http";
import { SourceVariable } from "../models/SourceVariable";
import { InvalidTypeError } from "../models/errors/Errors";
import { Observable } from "rxjs";

@Injectable()
export class DebuggerHttpService {
	constructor(private http: Http) {
	}

	//TODO: extract into a validation module (or use some external lib)
	/** Throws InvalidTypeError if val is not typeof typeName, or val is undefined or null */
	private assertTypeofStrict(val: any, typeName: string): void {
		if(val === null || val === undefined || typeof val !== typeName) {
			throw new InvalidTypeError(typeName, val);
		}
	}

	/** Throws InvalidTypeError if val is not array, or val is undefined or null */
	private assertArrayStrict(val: any): void {
		if(val === null || val === undefined || val.constructor !== Array) {
			throw new InvalidTypeError('array', val);
		}
	}

	private makeInvalidServerDataError(typeName: string, data: any, message = "Server returned invalid data"): SpiceError {
		return new SpiceError(0, "InvalidServerDataError", `Failed to construct ${ typeName }: ${ message }.`, data);
	}

	private makeSafeSourceVariable(obj: any): SourceVariable {
		return new SourceVariable();
	}

	//TODO: move all these "make from obj" functions to static functions in the model definitions (ill do this tomorrow)
	private makeSafeSourceFunction(obj: any): SourceFunction {

		try {
			this.assertTypeofStrict(obj, 'object');
			this.assertTypeofStrict(obj.address, 'number');
			this.assertTypeofStrict(obj.name, 'string');
			this.assertTypeofStrict(obj.sourcePath, 'string');
			this.assertTypeofStrict(obj.lineNumber, 'number');
			this.assertTypeofStrict(obj.lineCount, 'number');
			this.assertArrayStrict(obj.parameters);
			this.assertArrayStrict(obj.localVariables);

			let parameters: SourceVariable[] = (<any[]>obj.parameters).map(p => this.makeSafeSourceVariable(p));
			let localVariables: SourceVariable[] = (<any[]>obj.localVariables).map(v => this.makeSafeSourceVariable(v));

			return new SourceFunction(obj.address, obj.name, obj.sourcePath, obj.lineNumber, obj.lineCount, parameters, localVariables);
		}
		catch(e) {
			throw this.makeInvalidServerDataError('SourceFunction', e);
		}
	}

	public getFunctions(id: DebugId): Observable<{[id: string]: SourceFunction}> {
		return this.http.get(`/api/v1/debug/${id}/functions`)
			.map(function(res: any) {
				let data: any = res.json().data;
				this.assertArrayStrict(data);

				return (<any[]>data).map(sf => this.makeSafeSourceFunction(sf))
					.reduce((o, sf) => { o[sf.id] = sf; return o; });
			});
	}

	public getFunction(id: DebugId, sourceFunctionId: SourceFunctionId): Observable<SourceFunction> {
		return this.http.get(`/api/v1/debug/${id}/functions/${sourceFunctionId}`)
			.map(function(res: any) {
				return this.makeSafeSourceFunction(res.json().data);
			});
	}
}
