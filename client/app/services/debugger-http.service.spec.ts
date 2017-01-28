import { ReflectiveInjector } from "@angular/core";
import {tick, fakeAsync} from '@angular/core/testing';
import {ConnectionBackend, Http, RequestOptions, BaseRequestOptions, Response, ResponseOptions} from "@angular/http";
import {MockBackend, MockConnection} from '@angular/http/testing';

import { DebuggerHttpService } from "./debugger-http.service";
import { SourceFunction } from "../models/SourceFunction";
fdescribe('DebuggerHttpService', function () {

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
		this.sourceVariables = {};
		this.sourceVariables['0'] = `{"id": "0", "name": "a", "sType": "int", "address": 0}`;
		this.sourceVariables['1'] = `{"id": "1", "name": "b", "sType": "int", "address": 4}`;
		this.sourceVariables['2'] = `{"id": "2", "name": "tmp", "sType": "int", "address": 8}`;
		this.sourceFunctions = {};
		this.sourceFunctions['0'] = `{"address": 0, "name": "add", "sourcePath": "add.cpp", "lineNumber": 0, "lineCount": 5,
										"parameters": [${this.sourceVariables['0']}, ${this.sourceVariables['1']}], "localVariables": [${this.sourceVariables['2']}]}`;
	});

	it('should get the specified function', done => {
		this.debuggerHttpService.getFunction(0, 0).subscribe(
			(sf:SourceFunction) => {
				console.log('hi');
				console.log(this.lastConnection);
				expect(this.lastConnection).toBeDefined('Http');
				expect(sf).toBeDefined();
				expect(sf.id).toEqual('0');
				expect(sf.address).toEqual(0);
				expect(sf.name).toEqual('add');
				expect(sf.sourcePath).toEqual('add.cpp');
				expect(sf.lineNumber).toEqual(0);
				expect(sf.lineCount).toEqual(5);
				done();
			}, (err: any) => {console.log(err.data.message); fail(err)});
		this.lastConnection.mockRespond(new Response(new ResponseOptions({body: this.sourceFunctions['0']})));
		//this.lastConnection.mockRespond(new Response(new ResponseOptions({status: 404})));
	});

});
