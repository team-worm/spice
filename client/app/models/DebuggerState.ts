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
import { Trace } from "./trace/Trace";

export class DebuggerState {

	public executions: CacheMap<Observable<Execution>>;
	public breakpoints: CacheMap<Observable<Breakpoint>>;
	public sourceFunctions: CacheMap<Observable<SourceFunction>>;
	public sourceVariables: CacheMap<Observable<SourceVariable>>;
	public traces: CacheMap<Observable<Trace>>;

	constructor(public id: DebugId, protected debuggerHttp: DebuggerHttpService) {
		this.executions = new CacheMap<Observable<Execution>>(k => debuggerHttp.getExecution(this.id, k));
		this.breakpoints = new CacheMap<Observable<Breakpoint>>();
		this.sourceFunctions = new CacheMap<Observable<SourceFunction>>(k => debuggerHttp.getSourceFunction(this.id, k));
		this.sourceVariables = new CacheMap<Observable<SourceVariable>>();
		this.traces = new CacheMap<Observable<Trace>>(k => debuggerHttp.getTrace(this.id, k));
	}

	public initialize(): Observable<null> {
		return Observable.forkJoin(
			//initialize functions
			this.debuggerHttp.getSourceFunctions(this.id)
				.map((sfs) => {
					sfs.forEach(sf => this.sourceFunctions.set(sf.id, Observable.of(sf)));
					//mock stuff--initialize source variables
					//this.sourceVariables['0'] = new SourceVariable('0', 'a', 'int', 0);
					//this.sourceVariables['1'] = new SourceVariable('1', 'b', 'int', 4);
					//this.sourceVariables['2'] = new SourceVariable('2', 'tmp', 'int', 8);
					//this.sourceFunctions['0'] = new SourceFunction(0, 'add', 'add.cpp', 0, 5,
					//[this.sourceVariables['0'], this.sourceVariables['1']],
					//[this.sourceVariables['1']])
				}))
			//initialize breakpoints
			// this.debuggerHttp.getBreakpoints(this.id)
			// 	.map((bs) => {
			// 		bs.forEach(b => this.breakpoints.set(b.sFunction.id, Observable.of(b)));
			// 	}))
			.map(() => null);
	}

	public getSourceFunction(id: SourceFunctionId): Observable<SourceFunction> {
		let sf = this.sourceFunctions.get(id);
		sf.subscribe(() => {}, e => this.sourceFunctions.delete(id));
		return sf;
	}

	public getSourceFunctions(): Observable<{[id: string]: SourceFunction}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.sourceFunctions.map).map(k => this.sourceFunctions.get(k)))
			.switchMap((vals: SourceFunction[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: SourceFunction}, v: SourceFunction) => { o[v.id] = v; return o;}, {}));
			});
	}

	public getSourceVariable(id: string): Observable<SourceVariable> {
		let sv = this.sourceVariables.get(id);
		sv.subscribe(() => {}, e => this.breakpoints.delete(id));
		return sv;
	}

	public getSourceVariables(): Observable<{[id: string]: SourceVariable}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.sourceVariables.map).map(k => this.sourceVariables.get(k)))
			.switchMap((vals: SourceVariable[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: SourceVariable}, v: SourceVariable) => { o[v.id] = v; return o;}, {}));
			});
	}

	public getExecution(id: ExecutionId): Observable<Execution> {
		let ex = this.executions.get(id);
		ex.subscribe(() => {}, e => this.executions.delete(id));
		return ex;
	}

	public getExecutions(): Observable<{[id: string]: Execution}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.executions.map).map(k => this.executions.get(k)))
			.switchMap((vals: Execution[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: Execution}, v: Execution) => { o[v.id] = v; return o;}, {}));
			});
	}

	public executeBinary(args: string, env: string): Observable<Execution> {
		return this.debuggerHttp.executeBinary(this.id, args, env)
			.map(e => {
				this.executions.set(e.id, Observable.of(e));
				return e;
			});
	}

	public executeFunction(id: SourceFunctionId, parameters: {[id: string]: any}): Observable<Execution> {
		return this.debuggerHttp.executeFunction(this.id, id, parameters)
			.map(e => {
				this.executions.set(e.id, Observable.of(e));
				return e;
			});
	}

	public getTrace(id: ExecutionId): Observable<Trace> {
		let t = this.traces.get(id);
		t.subscribe(() => {}, e => this.traces.delete(id));
		return t;
	}

	public getBreakpoint(id: SourceFunctionId): Observable<Breakpoint> {
		let b = this.breakpoints.get(id);
		b.subscribe(() => {}, e => this.breakpoints.delete(id));
		return b;
	}

	public getBreakpoints(): Observable<{[id: string]: Breakpoint}> {
		//for now, assume we have all functions, and just flatten them into a map
		return Observable.forkJoin(Object.keys(this.breakpoints.map).map(k => this.breakpoints.get(k)))
			.switchMap((vals: Breakpoint[]) => {
				return Observable.of(vals.reduce((o: {[id: string]: Breakpoint}, v: Breakpoint) => { o[v.sFunction] = v; return o;}, {}));
			});
	}

	public setBreakpoint(id: SourceFunctionId): Observable<Breakpoint> {
		return this.debuggerHttp.setBreakpoint(this.id, id)
			.map(b => {
				this.breakpoints.set(id, Observable.of(b));
				return b;
			});
	}

	public removeBreakpoint(id: SourceFunctionId): Observable<null> {
		return this.debuggerHttp.removeBreakpoint(this.id, id)
			.map(() => {
				return null;
			});
	}

	public static fromObjectStrict(obj: any, debuggerHttp: DebuggerHttpService): DebuggerState {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'number');

		return new DebuggerState(obj.id.toString(), debuggerHttp);
	}

}