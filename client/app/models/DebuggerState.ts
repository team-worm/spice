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
import { ExecutionId } from "./execution/ExecutionId";

export class DebuggerState {

	public executions: CacheMap<Observable<Execution>>;
	public breakpoints: CacheMap<Observable<Breakpoint>>;
	public sourceFunctions: CacheMap<Observable<SourceFunction>>;
	public sourceVariables: CacheMap<Observable<SourceVariable>>;

	constructor(public id: DebugId, protected debuggerHttp: DebuggerHttpService) {
		this.executions = new CacheMap<Observable<Execution>>();
		this.breakpoints = new CacheMap<Observable<Breakpoint>>();
		this.sourceFunctions = new CacheMap<Observable<SourceFunction>>((k) => debuggerHttp.getFunction(this.id, k));
		this.sourceVariables = new CacheMap<Observable<SourceVariable>>();
	}

	public initialize(): Observable<null> {
		return Observable.forkJoin(
			//initialize functions
			this.debuggerHttp.getFunctions(this.id)
				.map(function(sfs) {
					sfs.forEach(sf => this.sourceFunctions.set(sf.id, Observable.of(sf)));
					//mock stuff--initialize source variables
					//this.sourceVariables['0'] = new SourceVariable('0', 'a', 'int', 0);
					//this.sourceVariables['1'] = new SourceVariable('1', 'b', 'int', 4);
					//this.sourceVariables['2'] = new SourceVariable('2', 'tmp', 'int', 8);
					//this.sourceFunctions['0'] = new SourceFunction(0, 'add', 'add.cpp', 0, 5,
					//[this.sourceVariables['0'], this.sourceVariables['1']],
					//[this.sourceVariables['1']])
				}),
			//initialize breakpoints
			this.debuggerHttp.getBreakpoints(this.id)
				.map(function(bs) {
					bs.forEach(b => this.breakpoints.set(b.sFunction.id, Observable.of(b)));
				}))
			.switchMap(() => Observable.of(null));
	}

	public getSourceFunction(id: SourceFunctionId): Observable<SourceFunction> {
		let sf = this.sourceFunctions.get(id);
		sf.subscribe(() => {}, e => this.sourceFunctions.delete(id));
		return sf;
	}

	public getSourceFunctions(): Observable<{[id: string]: SourceFunction}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.sourceFunctions.map).map(k => this.sourceFunctions[k]))
			.switchMap((vals: SourceFunction[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: SourceFunction}, v: SourceFunction) => { o[v.id] = v; return o;}, {}));
			});
	}

	public getExecution(id: ExecutionId): Observable<Execution> {
		let ex = this.executions.get(id);
		ex.subscribe(() => {}, e => this.executions.delete(id));
		return ex;
	}

	public getExecutions(): Observable<{[id: string]: Execution}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.executions.map).map(k => this.executions[k]))
			.switchMap((vals: Execution[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: Execution}, v: Execution) => { o[v.id] = v; return o;}, {}));
			});
	}

	//public getExecution(id: ExecutionId): Observable<Execution> {
		//let sf = this.executions.get(id);
		//sf.subscribe(() => {}, e => this.executions.delete(id));
		//return sf;
	//}

	public static fromObjectStrict(obj: any, debuggerHttp: DebuggerHttpService): DebuggerState {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'string');

		return new DebuggerState(obj.id, debuggerHttp);
	}

}
