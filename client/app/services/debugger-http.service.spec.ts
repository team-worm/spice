import { ReflectiveInjector } from "@angular/core";
import {tick, fakeAsync} from '@angular/core/testing';
import {ConnectionBackend, Http, RequestOptions, BaseRequestOptions, Response, ResponseOptions} from "@angular/http";
import {MockBackend } from '@angular/http/testing';

import { DebuggerHttpService } from "./debugger-http.service";
import { SourceFunction } from "../models/SourceFunction";
import { DebuggerState } from "../models/DebuggerState";
import { Execution } from "../models/Execution";
import { Trace } from "../models/Trace";
import { SourceVariable } from "../models/SourceVariable";
import { Breakpoint } from "../models/Breakpoint";
describe('DebuggerHttpService', function () {

	beforeEach(() => {
		this.injector = ReflectiveInjector.resolveAndCreate([
			{provide: ConnectionBackend, useClass: MockBackend},
			{provide: RequestOptions, useClass: BaseRequestOptions},
			Http,
			DebuggerHttpService
		]);

		this.debuggerHttpService = this.injector.get(DebuggerHttpService);
		this.backend = this.injector.get(ConnectionBackend) as MockBackend;
		this.backend.connections.subscribe((connection: any) => this.lastConnection = connection);

		//mock data (MOVE THIS ELSEWHERE)
		this.debuggerStates = {};
		this.debuggerStates['0'] = `{"id": "0"}`;
		this.sourceVariables = {};
		this.sourceVariables['0'] = `{"id": "0", "name": "a", "sType": "int", "address": 0}`;
		this.sourceVariables['1'] = `{"id": "1", "name": "b", "sType": "int", "address": 4}`;
		this.sourceVariables['2'] = `{"id": "2", "name": "tmp", "sType": "int", "address": 8}`;
		this.sourceVariables['3'] = `{"id": "3", "name": "a", "sType": "int", "address": 12}`;
		this.sourceVariables['4'] = `{"id": "4", "name": "b", "sType": "int", "address": 16}`;
		this.sourceVariables['5'] = `{"id": "5", "name": "tmp", "sType": "int", "address": 20}`;
		this.sourceFunctions = {};
		this.sourceFunctions['0'] = `{"address": 0, "name": "add", "sourcePath": "add.cpp", "lineStart": 1, "lineCount": 5,
										"parameters": [${this.sourceVariables['0']}, ${this.sourceVariables['1']}], "localVariables": [${this.sourceVariables['2']}]}`;
		this.sourceFunctions['4'] = `{"address": 4, "name": "test", "sourcePath": "test.cpp", "lineStart": 6, "lineCount": 5,
										"parameters": [${this.sourceVariables['3']}, ${this.sourceVariables['4']}], "localVariables": [${this.sourceVariables['5']}]}`;

		this.executions = {};
		this.executions['0'] = `{"id": "0", "eType": "process", "status": "done", "executionTime": 200, "data": { "nextExecution": "1"}}`;
		this.executions['1'] = `{"id": "1", "eType": "function", "status": "executing", "executionTime": 100, "data": { "sFunction": ${this.sourceFunctions['0']} }}`;

		//each trace corresponds to an execution
		this.traces = {};
		//this.traces['1'] = `[
								//{"index": 0, "tType": 0, "line": 0, "data": { "state": [{"sVariable": "0", "value": 1}]}},
								//{"index": 1, "tType": 0, "line": 0, "data": { "state": [{"sVariable": "1", "value": 2}]}},
								//{"index": 2, "tType": 1, "line": 1, "data": { "output": "adding 1,2"}},
								//{"index": 3, "tType": 0, "line": 2, "data": { "state": [{"sVariable": "2", "value": 3}]}},
								//{"index": 4, "tType": 2, "line": 3, "data": { "cause": "ended", "returnValue": 3}}
							//]`
		this.traces['1'] = `[
								{"index": 0, "tType": 0, "line": 0, "data": { "state": [{"sVariable": ${this.sourceVariables['0']}, "value": 1}]}},
								{"index": 1, "tType": 0, "line": 0, "data": { "state": [{"sVariable": ${this.sourceVariables['1']}, "value": 2}]}},
								{"index": 2, "tType": 1, "line": 1, "data": { "output": "adding 1,2"}},
								{"index": 3, "tType": 0, "line": 2, "data": { "state": [{"sVariable": ${this.sourceVariables['2']}, "value": 3}]}},
								{"index": 4, "tType": 2, "line": 3, "data": { "cause": "ended", "returnValue": 3}}
							]`;

		this.breakpoints = `[
								{"sFunction": ${this.sourceFunctions['0']}, "metadata": ""},
								{"sFunction": ${this.sourceFunctions['4']}, "metadata": ""}
							]`;
	});

	describe('attachBinary', () => {
		it('should create a debugger state from the server data', done => {
			this.debuggerHttpService.attachBinary('foo').subscribe(
				(ds: DebuggerState) => {
					expect(ds).toBeDefined();
					expect(ds.info.id).toEqual('0');
					done();
				}, (err: any) => fail(err));
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.debuggerStates['0']})));
		});
	});

	describe('getSourceFunctions', () => {
		it('should get all functions', done => {
			this.debuggerHttpService.getSourceFunctions(0).subscribe(
				(sfs:SourceFunction[]) => {
					expect(sfs).toBeDefined();

					expect(sfs[0]).toBeDefined();
					expect(sfs[0].address).toEqual(0);
					expect(sfs[0].name).toEqual('add');
					expect(sfs[0].sourcePath).toEqual('add.cpp');
					expect(sfs[0].lineStart).toEqual(1);
					expect(sfs[0].lineCount).toEqual(5);

					expect(sfs[1]).toBeDefined();
					expect(sfs[1].address).toEqual(4);
					expect(sfs[1].name).toEqual('test');
					expect(sfs[1].sourcePath).toEqual('test.cpp');
					expect(sfs[1].lineStart).toEqual(6);
					expect(sfs[1].lineCount).toEqual(5);
					done();
				}, (err: any) => {console.log(err.data.message); fail(err)});
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: `[${this.sourceFunctions['0']},${this.sourceFunctions['4']}]`})));
		});
	});


	describe('getSourceFunction', () => {
		it('should get the specified function', done => {
			this.debuggerHttpService.getSourceFunction(0, 0).subscribe(
				(sf:SourceFunction) => {
					expect(sf).toBeDefined();
					expect(sf.address).toEqual(0);
					expect(sf.name).toEqual('add');
					expect(sf.sourcePath).toEqual('add.cpp');
					expect(sf.lineStart).toEqual(1);
					expect(sf.lineCount).toEqual(5);
					done();
				}, (err: any) => fail(err));
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.sourceFunctions['0']})));
			//this.lastConnection.mockRespond(new Response(new ResponseOptions({status: 404})));
		});
	});

	describe('executeFunction', () => {
		it('should return an execution', done => {
			this.debuggerHttpService.executeFunction(0, 0).subscribe(
				(e:Execution) => {
					expect(e).toBeDefined();
					expect(e.id).toEqual('1');
					expect(e.data).toBeDefined();
                    expect(e.data.eType).toEqual('function');
                    if (e.data.eType == 'function') {
                        expect(e.data.sFunction).toBeDefined();
                        expect(e.data.sFunction).toEqual(0);
                    }
					done();
				}, (err: any) => fail(err));
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.executions['1']})));
		});
	});

	describe('executeBinary', () => {
		it('should return an execution', done => {
			this.debuggerHttpService.executeBinary(0, 'arg=0', 'ENV=1').subscribe(
				(e:Execution) => {
					expect(e).toBeDefined();
					expect(e.id).toEqual('0');
					expect(e.data).toBeDefined();
					expect(e.data.eType).toEqual('process');
					done();
				}, (err: any) => fail(err));
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.executions['0']})));
			//this.lastConnection.mockRespond(new Response(new ResponseOptions({status: 404})));
		});
	});

	describe('getExecution', () => {
		it('should return an execution', done => {
			this.debuggerHttpService.getExecution(0, '0').subscribe(
				(e:Execution) => {
					expect(e).toBeDefined();
					expect(e.id).toEqual('0');
					expect(e.data).toBeDefined();
					expect(e.data.eType).toEqual('process');
					done();
				}, (err: any) => fail(err));
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.executions['0']})));
		});
	});

	describe('getTrace', () => {
		it('should return an observable that streams traces', done => {
			let traceIndex = 0;
			this.debuggerHttpService.getTrace(0, '1').subscribe(
				(t:Trace) => {
					switch(traceIndex) {
					case 0:
						expect(t).toBeDefined();
						expect(t.index).toEqual(0);
						expect(t.line).toEqual(0);
						expect(t.data).toEqual({tType: 'line', state: [{sVariable: 'a', value: 1}]});
						traceIndex++;
						break;
					case 1:
						expect(t).toBeDefined();
						expect(t.index).toEqual(1);
						expect(t.line).toEqual(0);
						expect(t.data).toEqual({tType: 'line', state: [{sVariable: 'b', value: 2}]});
						traceIndex++;
						break;
					case 2:
						expect(t).toBeDefined();
						expect(t.index).toEqual(2);
						expect(t.line).toEqual(1);
						expect(t.data).toEqual({tType: 'line', output: 'adding 1,2'});
						traceIndex++;
						break;
					case 3:
						expect(t).toBeDefined();
						expect(t.index).toEqual(3);
						expect(t.line).toEqual(2);
						expect(t.data).toEqual({tType: 'line', state: [{sVariable: 'tmp', value: 3}]});
						traceIndex++;
						break;
					case 4:
						expect(t).toBeDefined();
						expect(t.index).toEqual(4);
						expect(t.line).toEqual(3);
						expect(t.data).toEqual({tType: 'return', value: '3', stack: undefined, nextExecution: undefined});
						done();
						break;
					}
				}, (err: any) => {console.log(err.data); fail(err)});
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.traces['1']})));
		});
	});

	describe('getBreakpoints', () => {
		it('should return an array breakpoints', done => {
			this.debuggerHttpService.getBreakpoints(0).subscribe(
				(bs: Breakpoint[]) => {
					expect(bs).toBeDefined();
					expect(bs[0]).toBeDefined();
					expect(bs[0].sFunction).toBeDefined();

					expect(bs[1]).toBeDefined();
					expect(bs[1].sFunction).toBeDefined();
					done();
				});
			this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.breakpoints})));
		});
	});
});
