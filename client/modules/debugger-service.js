angular.module('Spice')
	.factory('DebuggerService', ['$q', '$http', function($q, $http){

		/*** Constructors ***/

		/**
		 * @constructor
		 * @param {int} code
		 * @param {string} name
		 * @param {string} message
		 * @param {object} data
		 */
		var SpiceError = function(code, name, message, data) {
			this.code = code;
			this.name = name;
			this.message = message;
			this.data = data;

			this.stack = (new Error()).stack;
		}

		SpiceError.prototype = new Error();

		/**
		 * @constructor
		 * @param {DebugId} id
		 * @param {string} name
		 */
		var DebugState = function(id) {
			this.id = id;

			this.executions = {}; // map[executionId]Execution
			this.breakpoints = {}; //map[address]Breakpoint
			this.functions = {}; // map[address]SourceFunction
		}

		/**
		 * @constructor
		 * @param {ExecutionId} executionId
		 * @param {string} eType
		 * @param {string} status
		 * @param {integer} executionTime
		 * @param {object} data
		 */
		var Execution = function(id, eType, status, executionTime, data) {
			this.id = id;
			this.eType = eType;
			this.status = status;
			this.executionTime = executionTime;
			this.data = data;

			this.trace = null;

		}

		/**
		 * @constructor
		 * @param {number} index
		 * @param {number} tType
		 * @param {number} line
		 * @param {object} data
		 */
		var Trace = function(index, tType, line, data) {
			this.index = index;
			this.tType = tType;
			this.line = line;
			this.data = data;
		}

		/**
		 * @constructor
		 * @param {integer} address
		 * @param {string} name
		 */
		var SourceFunction = function(address, name, sourcePath, lineNumber, lineCount, parameters, localVariables) {
			this.address = address;
			this.name = name;
			this.sourcePath = sourcePath;
			this.lineNumber = lineNumber;
			this.lineCount = lineCount;
			this.parameters = parameters;
			this.localVariables = localVariables;
		}

		/**
		 * @constructor
		 * @param {Variable id} id
		 * @param {string} name
		 * @param {SourceType} sType
		 * @param {integer} address
		 */
		var SourceVariable = function(id, name, sType, address) {
			this.id = id;
			this.name = name;
			this.sType = sType;
			this.address = address;
		}

		/**
		 * TODO: make this not a placeholder type
		 * @constructor
		 * @param {string} name
		 */
		var SourceType = function(name) {
			this.name = name;
		}

		/**
		 * @constructor
		 * @param {string} name
		 */
		var Breakpoint = function(functionId, metadata) {
			this.functionId = functionId;
			this.metadata = metadata;
		}

		var StreamClosedError = function(message) {
			this.stack = (new Error()).stack;
		}

		StreamClosedError.prototype = new Error();
		StreamClosedError.prototype.name = 'StreamClosedError';

		/**
		 * Represents data that may be streamed.
		 * every write appends to the "data" array
		 * @constructor
		 */
		var Stream = function() {
			this.data = [];
			this.closed = false;
			this.closeError = undefined;

			this.listeners = []; // map[int]function: new listener created for each "read" call
			this.currentListenerId = 0; // incremented for each read call
		}

		Stream.prototype.write = function(newData) {
			if(this.closed) {
				throw new StreamClosedError('Stream.write: Cannot write to closed stream');
			}

			this.data.push(newData);
			this._sendEvent({
				type: 'write',
				index: this.data.length - 1
			});
		};

		Stream.prototype.close = function(err) {
			if(this.closed) {
				throw new StreamClosedError('Stream.close: Cannot close an already closed stream');
			}

			this.closed = true;
			this.closeError = err;
			this._sendEvent({
				type: 'close',
				error: err
			});
		};

		Stream.prototype._sendEvent = function(event) {
			var _this = this;
			Object.keys(_this.listeners).forEach(function(key) {
				_this.listeners[key](event);
			});
		}

		/**
		 * @returns {object}
		 */
		Stream.prototype.read = function(onData) {
			var _this = this;
			var listenerId = this.currentListenerId;
			this.currentListenerId++;
			return {
				id: listenerId,
				done: $q(function(resolve, reject) {
					// call onData for all existing writes
					for(var i = 0; i < _this.data.length; i++) {
						onData(_this.data[i]);
					}

					if(_this.closed) {
						if(_this.closeError) {
							reject(_this.closeError);
						}
						else {
							resolve();
						}
						return;
					}

					// listen for new events
					_this.listeners[listenerId] = function(event) {
						switch(event.type) {
							case 'write':
								onData(_this.data[event.index]);
								break;
							case 'close':
								_this.cancelRead(listenerId);
								if(event.error) {
									reject(event.error);
								}
								else {
									resolve();
								}
								break;
						}
					}
				})
			};
		};

		Stream.prototype.cancelRead = function(readId) {
			delete this.listeners[readId];
		}

		/*** CurrentState ***/
		var attachedDebugState = null;

		/*** Public Functions ***/
		function getAttachedDebugState() {
			return attachedDebugState;
		}

		/**
		 * @param {string} path
		 * @returns {Promise<DebugState>}
		 */
		function attachBinary(path) {
			return _attachBinary(path)
				.then(function(state) {
					attachedDebugState = state;
					return attachedDebugState;
				});
		}

		/**
		 * @returns {Promise<map[functionId]SourceFunction>}
		 */
		function getFunctions() {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _getFunctions(attachedDebugState)
				.then(function(functions) {
					attachedDebugState.functions = functions.reduce(function(fs, func) {
						fs[func.address] = func;
						return fs;
					}, {});
					return attachedDebugState.functions;
				});
		}

		/**
		 * @param {function id} id
		 * @returns {Promise<SourceFunction>}
		 */
		function getFunction(id) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _getFunction(attachedDebugState, id)
				.then(function(func) {
					attachedDebugState.functions[func.address] = func;
					return func;
				});
		}

		/**
		 * @returns {Promise<map[functionId]Breakpoint>}
		 */
		function getBreakpoints() {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _getBreakpoints(attachedDebugState)
				.then(function(breakpoints) {
					attachedDebugState.breakpoints = breakpoints.reduce(function(bs, breakpoint) {
						bs[breakpoint.functionId] = breakpoint;
						return bs;
					}, {});
					return attachedDebugState.breakpoints;
				});
		}

		/**
		 * @param {FunctionId} functionId
		 * @returns {Promise<Breakpoint>}
		 */
		function setBreakpoint(functionId) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _setBreakpoint(attachedDebugState, functionId)
				.then(function(breakpoint) {
					attachedDebugState.breakpoint[breakpoint.functionId] = breakpoint;
					return breakpoint;
				});
		}

		/**
		 * @param {FunctionId} functionId
		 * @returns {Promise<Breakpoint>}
		 */
		function removeBreakpoint(functionId) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _removeBreakpoint(attachedDebugState, functionId)
				.then(function() {
					delete attachedDebugState.breakpoint[functionId];
				});
		}

		/**
		 * @param {string} args
		 * @param {string} env
		 * @returns {Promise<Execution>}
		 */
		function execute(args, env) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _execute(attachedDebugState, args, env)
				.then(function(execution) {
					attachedDebugState.executions[execution.id] = execution;
					return execution;
				});
		}

		/**
		 * @param {FunctionId} functionId
		 * @param {object} parameters
		 * @returns {Promise<Execution>}
		 */
		function executeFunction(functionId, parameters) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return _executeFunction(attachedDebugState, functionId, parameters)
				.then(function(execution) {
					attachedDebugState.executions[execution.id] = execution;
					return execution;
				});
		}

		/**
		 * @param {ExecutionId} id
		 * @returns {Promise<Stream>}
		 */
		function getTrace(id) {
			if(attachedDebugState === null) {
				return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
			}

			return $q.resolve(attachedDebugState.executions[id])
				.then(function(execution) {
					if(execution) {
						return execution;
					}
					else {
						return _getExecution(attachedDebugState, id)
							.then(function(ex) {
								attachedDebugState.executions[ex.id] = ex;
								return ex;
							});
					}
				}).then(function(execution) {
					if(execution.trace) {
						return execution.trace;
					}
					else {
						execution.trace = _getExecutionTrace(attachedDebugState, id);
						return execution.trace;
					}
				});
		}

		/*** Private Functions ***/

		/*** Debug ***/

		/**
		 * @param {string} path
		 * @returns {DebugState}
		 */
		function _attachBinary(path) {
			//TODO: use $http POST /debug/attach/bin/:path*
			return $q.resolve(new DebugState(0));
		}

		/**
		 * @param {DebugState} debugState
		 * @param {string} args
		 * @param {string} env
		 * @returns {Promise<Execution>}
		 */
		function _execute(debugState, args, env) {
			//TODO: use $http POST /debug/:debugId/execute
			return $q.resolve(new Execution(0, 'process', 'done', 10, {nextExecution: 1}));
		}

		/**
		 * @param {DebugState} debugState
		 * @param {FunctionId} functionId
		 * @param {object} parameters
		 * @returns {Promise<Execution>}
		 */
		function _executeFunction(debugState, functionId, parameters) {
			//TODO: use $http POST /debug/:debugId/functions/:function/execute
			if(functionId === 0) {
				return $q.resolve(new Execution(2, 'function', 'done', 10, { sourceFunction: 0}));
			}
			else {
				return $q.reject(new SpiceError(0, 'NotFoundError', 'Function ' + id + ' not found', {id: id}));
			}
		}

		/*** SourceFunctions ***/
		function _getFunctions(debugState) {
			//TODO: use $http GET /debug/:debugId/functions
			return $q.resolve([new SourceFunction(0, 'helloFunc', 'hello.cpp', 4, 4, [new SourceVariable(0, 'a', new SourceType('int'), 0)], [new SourceVariable(1, 'str', new SourceType('std::string'), 1)])]);
		}

		function _getFunction(debugState, id) {
			//TODO: use $http GET /debug/:debugId/functions/:function
			if(id === 0) {
				return $q.resolve(new SourceFunction(0, 'helloFunc', 'hello.cpp', 4, 4, [new SourceVariable(0, 'a', new SourceType('int'), 0)], [new SourceVariable(1, 'str', new SourceType('std::string'), 1)]));
			}
			else {
				return $q.reject(new SpiceError(0, 'NotFoundError', 'Function ' + id + ' not found', {id: id}));
			}
		}

		/*** Breakpoints **/

		function _getBreakpoints(debugState) {
			//TODO: use $http GET /debug/:debugId/breakpoints
			return $q.resolve([new Breakpoint(0, {})]);
		}

		function _setBreakpoint(debugState, functionId) {
			//TODO: use $http PUT /debug/:debugId/breakpoints/:function
			return $q.resolve([new Breakpoint(0, {})]);
		}

		function _removeBreakpoint(debugState, functionId) {
			//TODO: use $http DELETE /debug/:debugId/breakpoints/:function
			return $q.resolve();
		}

		/*** Executions ***/

		/**
		 * @param {DebugState} debugState
		 * @param {ExecutionId} id
		 * @returns {Promise<Execution>}
		 */
		function _getExecution(debugState, id) {
			//TODO: use $http GET /debug/:debugId/executions/:executionId
			if(id === 0) {
				return $q.resolve(new Execution(0, 'process', 'done', 10, {nextExecution: 1}));
			}
			else if(id === 1) {
				return $q.resolve(new Execution(1, 'function', 'done', 10, {sourceFunction: 0}));
			}
			else if(id === 2) {
				return $q.resolve(new Execution(2, 'function', 'done', 10, {sourceFunction: 0}));
			}
			else {
				return $q.reject(new SpiceError(0, 'NotFoundError', 'Function ' + id + ' not found', {id: id}));
			}
		}

		/**
		 * @param {DebugState} debugState
		 * @param {ExecutionId} id
		 * @returns {Stream<Trace>}
		 */
		function _getExecutionTrace(debugState, executionId) {
			//TODO: use $http GET /debug/:debugId/executions/:executionId/trace (with streaming api)
			var traceStream = new Stream();
			if(executionId === 0) {
				traceStream.write(new Trace(0, 1, 0, {output: 'print 1'}));
				traceStream.write(new Trace(1, 1, 2, {output: 'print 2'}));
				traceStream.write(new Trace(2, 2, 3, {cause: 'breakpoint', nextExecution: 1}));
			}
			else if(executionId === 1) {
				traceStream.write(new Trace(0, 0, 4, {state: [{variable: 0, value: 1}]}));
				traceStream.write(new Trace(1, 0, 5, {state: [{variable: 0, value: 2}]}));
				traceStream.write(new Trace(2, 0, 6, {state: [{variable: 1, value: 'hello'}]}));
				traceStream.write(new Trace(3, 1, 7, {output: '2'}));
				traceStream.write(new Trace(4, 2, 8, {cause: 'ended', returnValue: 3}));
			}
			else if(executionId === 2) {
				traceStream.write(new Trace(0, 0, 4, {state: [{variable: 0, value: 2}]}));
				traceStream.write(new Trace(1, 0, 5, {state: [{variable: 0, value: 4}]}));
				traceStream.write(new Trace(2, 0, 6, {state: [{variable: 1, value: 'hello'}]}));
				traceStream.write(new Trace(3, 1, 7, {output: '8'}));
				traceStream.write(new Trace(4, 2, 8, {cause: 'ended', returnValue: 9}));
			}
			else {
				throw new SpiceError(0, 'NotFoundError', 'Execution ' + executionId + ' not found', {id: executionId});
			}
			traceStream.close();
			return traceStream;
		}

		return {
			Stream: Stream, // TODO: move this into its own module
			getAttachedDebugState: getAttachedDebugState,
			attachBinary: attachBinary,
			getFunctions: getFunctions,
			getFunction: getFunction,
			getBreakpoints: getBreakpoints,
			setBreakpoint: setBreakpoint,
			removeBreakpoint: removeBreakpoint,
			execute: execute,
			executeFunction: executeFunction,
			getTrace: getTrace
		};
	}]);
