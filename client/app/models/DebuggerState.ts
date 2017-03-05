import { DebugInfo, DebugId } from "./DebugInfo";
import { Execution, ExecutionId } from "./Execution";
import { Breakpoint } from "./Breakpoint";
import { SourceFunction, SourceFunctionId } from "./SourceFunction";
import { SourceVariable } from "./SourceVariable";
import { Observable } from "rxjs/Observable";
import { CacheMap } from "../util/CacheMap";
import { DebuggerHttpService } from "../services/debugger-http.service";
import { Trace } from "./Trace";

export class DebuggerState {

    public executions: CacheMap<ExecutionId, Observable<Execution>>;
    public breakpoints: CacheMap<SourceFunctionId, Observable<Breakpoint>>;
    public sourceFunctions: CacheMap<SourceFunctionId, Observable<SourceFunction>>;
    public sourceVariables: CacheMap<string, Observable<SourceVariable>>;
    public traces: CacheMap<ExecutionId, Observable<Trace>>;

    constructor(public info: DebugInfo, protected debuggerHttp: DebuggerHttpService) {
        this.executions = new CacheMap<ExecutionId, Observable<Execution>>(k => debuggerHttp.getExecution(this.info.id, k));
        this.breakpoints = new CacheMap<SourceFunctionId, Observable<Breakpoint>>();
        this.sourceFunctions = new CacheMap<SourceFunctionId, Observable<SourceFunction>>(k => debuggerHttp.getSourceFunction(this.info.id, k));
        this.sourceVariables = new CacheMap<string, Observable<SourceVariable>>();
        this.traces = new CacheMap<ExecutionId, Observable<Trace>>(k => debuggerHttp.getTrace(this.info.id, k));
    }

    public initialize(): Observable<null> {
        return Observable.forkJoin(
            //initialize functions
            this.debuggerHttp.getSourceFunctions(this.info.id)
                .map((sfs) => {
                    sfs.forEach(sf => this.sourceFunctions.set(sf.address, Observable.of(sf)));
                }))
            //initialize breakpoints
            // this.debuggerHttp.getBreakpoints(this.info.id)
            // 	.map((bs) => {
            // 		bs.forEach(b => this.breakpoints.set(b.sFunction.id, Observable.of(b)));
            // 	}))
            .map(() => null);
    }

    public getSourceFunction(id: SourceFunctionId): Observable<SourceFunction> {
        let sf = this.sourceFunctions.get(id);
        sf.subscribe(() => { }, e => this.sourceFunctions.delete(id));
        return sf;
    }

    public getSourceFunctions(): Observable<{ [id: string]: SourceFunction }> {
        //for now, assume we have all functions, and just flatten them into a map
        return Observable.forkJoin(Array.from(this.sourceFunctions.keys(), (k: SourceFunctionId) => this.sourceFunctions.get(k)))
            .switchMap((vals: SourceFunction[]) => {
                return Observable.of(vals.reduce((o: { [id: string]: SourceFunction }, v: SourceFunction) => { o[v.address] = v; return o; }, {}));
            });
    }

    public getSourceVariable(id: string): Observable<SourceVariable> {
        let sv = this.sourceVariables.get(id);
        sv.subscribe(() => { }, e => this.sourceVariables.delete(id));
        return sv;
    }

    public getSourceVariables(): Observable<{ [id: string]: SourceVariable }> {
        //for now, assume we have all functions, and just flatten them into a map
        return Observable.forkJoin(Array.from(this.sourceVariables.keys(), (k: string) => this.sourceVariables.get(k))).defaultIfEmpty([])
            .switchMap((vals: SourceVariable[]) => {
                return Observable.of(vals.reduce((o: { [id: string]: SourceVariable }, v: SourceVariable) => { o[v.name] = v; return o; }, {}));
            });
    }

    public getExecution(id: ExecutionId): Observable<Execution> {
        let ex = this.executions.get(id);
        ex.subscribe(() => { }, e => this.executions.delete(id));
        return ex;
    }

    public getExecutions(): Observable<{ [id: string]: Execution }> {
        //for now, assume we have all functions, and just flatten them into a map
        return Observable.forkJoin(Array.from(this.executions.keys(), (k: ExecutionId) => this.executions.get(k))).defaultIfEmpty([])
            .switchMap((vals: Execution[]) => {
                return Observable.of(vals.reduce((o: { [id: string]: Execution }, v: Execution) => { o[v.id] = v; return o; }, {}));
            });
    }

    public executeBinary(args: string, env: string): Observable<Execution> {
        return this.debuggerHttp.executeBinary(this.info.id, args, env)
            .map(e => {
                this.executions.set(e.id, Observable.of(e));
                return e;
            });
    }

    public executeFunction(id: SourceFunctionId, parameters: { [id: string]: any }): Observable<Execution> {
        return this.debuggerHttp.executeFunction(this.info.id, id, parameters)
            .map(e => {
                this.executions.set(e.id, Observable.of(e));
                return e;
            });
    }

    public stopExecution(id: ExecutionId): Observable<Execution> {
        return this.debuggerHttp.stopExecution(this.info.id, id)
            .map(e => {
                this.executions.set(e.id, Observable.of(e));
                return e;
            });
    }

    public getTrace(id: ExecutionId): Observable<Trace> {
        let t = this.traces.get(id);
        t.subscribe(() => { }, e => this.traces.delete(id));
        return t;
    }

    public getBreakpoint(id: SourceFunctionId): Observable<Breakpoint> {
        let b = this.breakpoints.get(id);
        b.subscribe(() => { }, e => this.breakpoints.delete(id));
        return b;
    }

    public getBreakpoints(): Observable<Map<SourceFunctionId, Breakpoint>> {
        return Observable.forkJoin(Array.from(this.breakpoints.keys(), (k: SourceFunctionId) => this.breakpoints.get(k))).defaultIfEmpty([])
            .switchMap((vals: Breakpoint[]) => {
                return Observable.of(vals.reduce((m: Map<SourceFunctionId, Breakpoint>, b: Breakpoint) => { m.set(b.sFunction, b); return m; }, new Map()));
            });
    }

    public setBreakpoint(id: SourceFunctionId): Observable<Breakpoint> {
        return this.debuggerHttp.setBreakpoint(this.info.id, id)
            .map(b => {
                this.breakpoints.set(id, Observable.of(b));
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
