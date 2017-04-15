import { DebugInfo, DebugId } from "./DebugInfo";
import { Execution, ExecutionId } from "./Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction, SourceFunctionId } from "./SourceFunction";
import { SourceVariable, SourceVariableId } from "./SourceVariable";
import { Observable } from "rxjs/Observable";
import { DebuggerHttpService } from "../services/debugger-http.service";
import { Trace } from "./Trace";
import { Value } from "./Value";
import { SourceTypeId, SourceType } from "./SourceType";

export class DebuggerState {

	public executions: Map<ExecutionId, Execution>;
	public breakpoints: Map<SourceFunctionId, Breakpoint>;
	public sourceFunctions: Map<SourceFunctionId, SourceFunction>;
	public sourceVariables: Map<SourceVariableId, SourceVariable>;
	public traces: Map<ExecutionId, Observable<Trace>>;
	public sourceTypes: Map<SourceTypeId, SourceType>;
	public name: string = ''; //file/process name
	public binaryPath: string = '';
	public isBinary: boolean = false;

	constructor(public info: DebugInfo, protected debuggerHttp: DebuggerHttpService) {
		this.executions = new Map<ExecutionId, Execution>();
		this.breakpoints = new Map<SourceFunctionId, Breakpoint>();
		this.sourceFunctions = new Map<SourceFunctionId, SourceFunction>();
		this.sourceVariables = new Map<SourceVariableId, SourceVariable>();
		this.sourceTypes = new Map<SourceTypeId, SourceType>();
		this.traces = new Map<ExecutionId, Observable<Trace>>();
	}

	public initialize(): Observable<null> {
		return Observable.forkJoin(
			//initialize functions
			this.debuggerHttp.getSourceFunctions(this.info.id)
				.map((sfs) => {
					sfs.forEach(sf => this.sourceFunctions.set(sf.address, sf));
				}))
			//initialize breakpoints
			// this.debuggerHttp.getBreakpoints(this.info.id)
			// 	.map((bs) => {
			// 		bs.forEach(b => this.breakpoints.set(b.sFunction.id, Observable.of(b)));
			// 	}))
			.map(() => null);
	}

	protected ensureMapValues<K, V>(ids: K[], map: Map<K,V>, provider: (id:K) => Observable<V>, idFunc: (val:V) => K): Observable<Map<K,V>> {
		return Observable.forkJoin(...ids.filter(id => !map.has(id)).map(id => provider(id))).defaultIfEmpty([])
			.map((vals) => {
				vals.forEach(val => map.set(idFunc(val), val));
				return ids.reduce((o, id) => { o.set(id, map.get(id)!); return o; }, new Map<K,V>());
			});
	}

	public ensureSourceFunctions(ids: SourceFunctionId[]): Observable<Map<SourceFunctionId, SourceFunction>> {
		return this.ensureMapValues(ids, this.sourceFunctions, id => this.debuggerHttp.getSourceFunction(this.info.id, id), val => val.address);
	}

	public ensureAllSourceFunctions(): Observable<SourceFunction[]> {
		return this.debuggerHttp.getSourceFunctions(this.info.id)
			.map(sfs => {
				sfs.forEach(sf => this.sourceFunctions.set(sf.address, sf));
				return sfs;
			});
	}

	public ensureSourceTypes(ids: SourceTypeId[]): Observable<Map<SourceTypeId, SourceType>> {
		return this.debuggerHttp.getSourceTypes(this.info.id, ids)
			.mergeMap(sts => {
				Object.keys(sts).forEach(stId => this.sourceTypes.set(parseInt(stId), sts[stId]));
				function gatherSTypes(st: SourceType): Set<SourceTypeId> {
					let typeSet = new Set<SourceTypeId>();
					switch(st.data.tType) {
						case 'pointer':
							typeSet.add(st.data.sType);
							if(st.data.sType === 1252 || st.data.sType === 1257) {
							}
							break;
						case 'array':
							typeSet.add(st.data.sType);
							if(st.data.sType === 1252 || st.data.sType === 1257) {
							}
							break;
						case 'function':
							typeSet.add(st.data.sType);
							if(st.data.sType === 1252 || st.data.sType === 1257) {
							}
							st.data.parameters.forEach(tId => typeSet.add(tId));
							break;
						case 'struct':
							st.data.fields.forEach(field => typeSet.add(field.sType));
							break;
					}
					return typeSet;
				}
				let missingIds = Array.from(Object.keys(sts).map(stId => gatherSTypes(sts[stId]))
					.reduce((s, sIdSet) => {
						sIdSet.forEach(sId => {
							if(!this.sourceTypes.has(sId)) {
								s.add(sId);
							}
						});
						return s;
					}, new Set<SourceTypeId>()));

				if(missingIds.length === 0) {
					return Observable.of(ids.reduce((o, id) => {
						o.set(id, this.sourceTypes.get(id)!);
						return o;
					}, new Map<SourceTypeId, SourceType>()));
				}
				return this.ensureSourceTypes(missingIds)
					.map(missingSts => {
						return ids.concat(missingIds).reduce((o, id) => {
							o.set(id, this.sourceTypes.get(id)!);
							return o;
						}, new Map<SourceTypeId, SourceType>());
					});
			});
	}

	//public ensureSourceVariables(ids: SourceVariableId[]): Observable<SourceVariable[]> {
		//return this.ensureMapValues(ids, this.sourceVariables, id => this.debuggerHttp.getSourceVariable(this.info.id, id), val => val.address);
	//}

	public ensureExecutions(ids: ExecutionId[]): Observable<Map<ExecutionId, Execution>> {
		return this.ensureMapValues(ids, this.executions, id => this.debuggerHttp.getExecution(this.info.id, id), val => val.id);
	}

	public executeBinary(args: string, env: string): Observable<Execution> {
		return this.debuggerHttp.executeBinary(this.info.id, args, env)
			.map(e => {
				this.executions.set(e.id, e);
				return e;
			});
	}

	public callFunction(id: SourceFunctionId, parameters: {[address: number]: Value}): Observable<Execution> {
		return this.debuggerHttp.callFunction(this.info.id, id, parameters)
			.map(e => {
				this.executions.set(e.id, e);
				return e;
			});
	}

	public stopExecution(id: ExecutionId): Observable<null> {
		return this.debuggerHttp.stopExecution(this.info.id, id);
	}

	public killProcess():Observable<null> {
		return this.debuggerHttp.killProcess(this.info.id);
	}

	public ensureTrace(id: ExecutionId): Observable<Observable<Trace>> {
		if(this.traces.has(id)) {
			return Observable.of(this.traces.get(id));
		}
		let t = this.debuggerHttp.getTrace(this.info.id, id);
		this.traces.set(id, t);
		return Observable.of(t);
	}

	public setBreakpoint(id: SourceFunctionId): Observable<Breakpoint> {
		return this.debuggerHttp.setBreakpoint(this.info.id, id)
			.map(b => {
				this.breakpoints.set(id, b);
				return b;
			});
	}

	public removeBreakpoint(id: SourceFunctionId): Observable<null> {
		return this.debuggerHttp.removeBreakpoint(this.info.id, id)
			.map(() => {
				this.breakpoints.delete(id);
				return null;
			});
	}

}
