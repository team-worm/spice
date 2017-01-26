import { DebugId } from "./DebugId";
import { Execution } from "./execution/Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction } from "./SourceFunction";
import { SourceVariable } from "./SourceVariable";
import { SpiceValidator } from "../util/SpiceValidator";
import { Observable } from "rxjs/Observable";
import { CacheMap } from "../util/CacheMap";
import { DebuggerHttpService } from "../services/debugger-http.service";
import { SourceFunctionId } from "./SourceFunctionId";

export class DebuggerState {

	protected executions: CacheMap<Observable<Execution>>;
	protected breakpoints: CacheMap<Observable<Breakpoint>>;
	protected sourceFunctions: CacheMap<Observable<SourceFunction>>;
	protected sourceVariables: CacheMap<Observable<SourceVariable>>;

	constructor(public id: DebugId, protected debuggerHttp: DebuggerHttpService) {
		this.executions = new CacheMap<Observable<Execution>>();
		this.breakpoints = new CacheMap<Observable<Breakpoint>>();
		this.sourceFunctions = new CacheMap<Observable<SourceFunction>>((k) => debuggerHttp.getFunction(this.id, k));
		this.sourceVariables = new CacheMap<Observable<SourceVariable>>();
	}

	public initialize(): Observable<null> {
		//initialize functions
		
		this.debuggerHttp.getFunctions(this.id)
			.map(function(sfs) {
				//sfs.map(
			});
			//TODO: error handling

		//mock stuff--initialize source variables
		//this.sourceVariables['0'] = new SourceVariable('0', 'a', 'int', 0);
		//this.sourceVariables['1'] = new SourceVariable('1', 'b', 'int', 4);
		//this.sourceVariables['2'] = new SourceVariable('2', 'tmp', 'int', 8);
		//this.sourceFunctions['0'] = new SourceFunction(0, 'add', 'add.cpp', 0, 5,
			//[this.sourceVariables['0'], this.sourceVariables['1']],
			//[this.sourceVariables['1']])
		return Observable.of(null);
	}

	public getSourceFunction(id: SourceFunctionId): Observable<SourceFunction> {
		let sf = this.sourceFunctions.get(id);
		sf.subscribe(() => {}, e => this.sourceFunctions.delete(id));
		return sf;
	}

	public static fromObjectStrict(obj: any, debuggerHttp: DebuggerHttpService): DebuggerState {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'string');

		return new DebuggerState(obj.id, debuggerHttp);
	}

}
