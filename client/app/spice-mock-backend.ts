import { Http, XHRBackend, BaseRequestOptions, RequestMethod, RequestOptions, Request, Response, ResponseOptions } from "@angular/http";
import { MockBackend, MockConnection } from "@angular/http/testing";


const host:string = 'http://localhost';
const port:number = 3000;
const responseDelay:number = 50;

let debuggerStates = {
	'0': `{"id": 0, "attachedProcess":{"id": 123, "name": "SpiceTestApp"}, "sourcePath": "testBin/SpiceTestApp.exe"}`,
	'1': `{"id": 1, "attachedProcess":{"id": 456, "name": "Collatz"}, "sourcePath": "collatz.exe"}`,
};
let sourceVariables = {
	'0': `{"id": 0, "name": "a", "sType": "int", "address": 0}`,
	'1': `{"id": 1, "name": "b", "sType": "int", "address": 4}`,
	'2': `{"id": 2, "name": "tmp", "sType": "int", "address": 8}`,
	'3': `{"id": 3, "name": "a", "sType": "int", "address": 12}`,
	'4': `{"id": 4, "name": "b", "sType": "int", "address": 16}`,
	'5': `{"id": 5, "name": "tmp", "sType": "int", "address": 20}`,
	'6': `{"id": 6, "name": "n", "sType": "int", "address": 0}`,
	'7': `{"id": 7, "name": "t", "sType": "int", "address": 4}`,
};
let sourceFunctions = {
	'0': `{"address": 0, "name": "add", "sourcePath": "add.cpp", "lineStart": 1, "lineCount": 5,
		"parameters": [${sourceVariables['0']}, ${sourceVariables['1']}], "localVariables": [${sourceVariables['2']}]}`,
	'4': `{"address": 4, "name": "test", "sourcePath": "test.cpp", "lineStart": 6, "lineCount": 5,
		"parameters": [${sourceVariables['3']}, ${sourceVariables['4']}], "localVariables": [${sourceVariables['5']}]}`,
	'8': `{"address": 8, "name": "collatz", "sourcePath": "collatz.c", "lineStart": 0, "lineCount": 12,
		"parameters": [${sourceVariables['6']}], "localVariables": [${sourceVariables['7']}]}`
};

let executions = {
		'0': `{"id": 0, "eType": "process", "status": "done", "executionTime": 200, "data": { "nextExecution": 1}}`,
		'1': `{"id": 1, "eType": "function", "status": "executing", "executionTime": 100, "data": { "sFunction": ${sourceFunctions['0']} }}`,
		'2': `{"id": 2, "eType": "function", "status": "done", "executionTime": 250, "data": { "sFunction": ${sourceFunctions['8']} }}`
};

//each trace corresponds to an execution
let traces = {
		//this.traces['1'] = `[
								//{"index": 0, "tType": 0, "line": 0, "data": { "state": [{"sVariable": "0", "value": 1}]}},
								//{"index": 1, "tType": 0, "line": 0, "data": { "state": [{"sVariable": "1", "value": 2}]}},
								//{"index": 2, "tType": 1, "line": 1, "data": { "output": "adding 1,2"}},
								//{"index": 3, "tType": 0, "line": 2, "data": { "state": [{"sVariable": "2", "value": 3}]}},
								//{"index": 4, "tType": 2, "line": 3, "data": { "cause": "ended", "returnValue": 3}}
							//]`
	'0': `[
			{"index": 0, "tType": 1, "line": 1, "data": { "output": "beginning process"}},
			{"index": 1, "tType": 2, "line": 3, "data": { "cause": "breakpoint", "nextExecution": 1}}
		]`,
	'1': `[
			{"index": 0, "tType": 0, "line": 0, "data": { "state": [{"sVariable": ${sourceVariables['0']}, "value": "1"}]}},
			{"index": 1, "tType": 0, "line": 0, "data": { "state": [{"sVariable": ${sourceVariables['1']}, "value": "2"}]}},
			{"index": 2, "tType": 1, "line": 1, "data": { "output": "adding 1,2"}},
			{"index": 3, "tType": 0, "line": 2, "data": { "state": [{"sVariable": ${sourceVariables['2']}, "value": "3"}]}},
			{"index": 4, "tType": 2, "line": 3, "data": { "cause": "ended", "returnValue": "3"}}
		]`,
	'2': `[
			{"index": 0, "tType": 0, "line": 1, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "3"}]}},
			{"index": 1, "tType": 0, "line": 2, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "0"}]}},
			{"index": 2, "tType": 0, "line": 7, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "10"}]}},
			{"index": 3, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "1"}]}},
			{"index": 4, "tType": 0, "line": 5, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "5"}]}},
			{"index": 5, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "2"}]}},
			{"index": 6, "tType": 0, "line": 7, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "16"}]}},
			{"index": 7, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "3"}]}},
			{"index": 8, "tType": 0, "line": 5, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "8"}]}},
			{"index": 9, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "4"}]}},
			{"index": 10, "tType": 0, "line": 5, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "4"}]}},
			{"index": 11, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "6"}]}},
			{"index": 12, "tType": 0, "line": 5, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "2"}]}},
			{"index": 13, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "7"}]}},
			{"index": 14, "tType": 0, "line": 5, "data": { "state": [{"sVariable": ${sourceVariables['6']}, "value": "1"}]}},
			{"index": 15, "tType": 0, "line": 9, "data": { "state": [{"sVariable": ${sourceVariables['7']}, "value": "8"}]}},
			{"index": 16, "tType": 2, "line": 11, "data": { "cause": "ended", "returnValue": "8"}}
		]`
};

let breakpoints = {
		'0': `{"sFunction": ${sourceFunctions['0']}, "metadata": ""}`,
		'4': `{"sFunction": ${sourceFunctions['4']}, "metadata": ""}`,
		'8': `{"sFunction": ${sourceFunctions['8']}, "metadata": ""}`,
};

//separate dictionaries bc methods are defined in enum which can't be used as a key
let urlsGet: {[url: string]: string} = {
	'/api/v1/debug/0/functions': `[${Object.keys(sourceFunctions).map(k => sourceFunctions[k]).join(',')}]`,
	'/api/v1/debug/0/functions/0': sourceFunctions['0'],
	'/api/v1/debug/0/functions/4': sourceFunctions['4'],
	'/api/v1/debug/1/functions': `[${Object.keys(sourceFunctions).map(k => sourceFunctions[k]).join(',')}]`,
	'/api/v1/debug/1/functions/8': sourceFunctions['8'],

	'/api/v1/debug/0/breakpoints': `[]`,
	'/api/v1/debug/1/breakpoints': `[]`,

	'/api/v1/debug/0/executions/0': executions['0'],
	'/api/v1/debug/0/executions/1': executions['1'],
	'/api/v1/debug/1/executions/2': executions['2'],

	'/api/v1/debug/0/executions/0/trace': traces['0'],
	'/api/v1/debug/0/executions/1/trace': traces['1'],
	'/api/v1/debug/1/executions/2/trace': traces['2'],
};
let urlsPost: {[url: string]: string} = {
	'/api/v1/debug/attach/bin/testBin/SpiceTestApp.exe': debuggerStates['0'],
	'/api/v1/debug/0/execute': executions['0'],
	'/api/v1/debug/attach/bin/collatz.exe': debuggerStates['1'],
	'/api/v1/debug/1/execute': executions['2'],
};
let urlsPut: {[url: string]: string} = {
	//'/api/v1/debug/0/functions': `{}`
};
let urlsDelete: {[url: string]: string} = {
	//'/api/v1/debug/0/functions': `{}`
};

function mapUrls(urls: {[url: string]: string}, config: {host: string, port: number}): {[url: string]: string} {
	return Object.keys(urls).reduce((o, k) => {o[`${host}:${port}${k}`] = urls[k]; return o;}, {});
}

urlsGet = mapUrls(urlsGet, {host: host, port: port});
urlsPost = mapUrls(urlsPost, {host: host, port: port});
urlsPut = mapUrls(urlsPut, {host: host, port: port});
urlsDelete = mapUrls(urlsDelete, {host: host, port: port});

export let SpiceMockBackend = {
	provide: Http,
	deps: [MockBackend, BaseRequestOptions, XHRBackend],
	useFactory: (backend: MockBackend, options: BaseRequestOptions, realBackend: XHRBackend) => {
		backend.connections.subscribe((connection: MockConnection) => {
			// wrap in timeout to simulate server api call
			setTimeout(() => {
				let body: string | undefined = undefined;
				switch(connection.request.method) {
					case RequestMethod.Get:
						body = urlsGet[connection.request.url];
						break;
					case RequestMethod.Post:
						body = urlsPost[connection.request.url];
						break;
					case RequestMethod.Put:
						body = urlsPut[connection.request.url];
						break;
					case RequestMethod.Delete:
						body = urlsDelete[connection.request.url];
						break;
				}

				if(body !== undefined) {
					connection.mockRespond(new Response(new ResponseOptions({ status: 200, body: body})));
					return;
				}

				// pass through any requests not handled above
				let realHttp = new Http(realBackend, options);
				let requestOptions = new RequestOptions({
					method: connection.request.method,
					headers: connection.request.headers,
					body: connection.request.getBody(),
					url: connection.request.url,
					withCredentials: connection.request.withCredentials,
					responseType: connection.request.responseType
				});
				realHttp.request(connection.request.url, requestOptions)
				.subscribe((response: Response) => {
					connection.mockRespond(response);
				},
				(error: any) => {
					connection.mockError(error);
				});

			}, responseDelay);

		});

		return new Http(backend, options);
	}
};
