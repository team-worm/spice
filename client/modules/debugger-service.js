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
		}

		/**
		 * @constructor
		 * @param {DebugId} id
		 * @param {string} name
		 */
		var DebugState = function(id) {
			this.id = id;
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
		}

		/**
		 * @constructor
		 * @param {integer} index
		 * @param {integer} tType
		 * @param {integer} line
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
		var SourceFunction = function(address, name) {
			this.address = address;
			this.name = name;
		}

		/**
		 * @constructor
		 * @param {Variable id} id
		 * @param {string} name
		 * @param {SourceType} sType
		 * @param {integer} address
		 */
		var SourceVariable = function(id, name, sType, address) {
			this.id = name;
			this.name = name;
			this.sType = name;
			this.address = address;
		}

		/*** Debug ***/

		/**
		 * @param {string} path
		 * @returns {DebugState}
		 */
		function attachBinary(path) {
			//TODO: use $http POST /debug/attach/bin/:path*
			return $q.resolve(new DebugState(0));
		}

		/**
		 * @param {DebugState} debugState
		 * @param {string} args
		 * @param {string} env
		 * @returns {Execution}
		 */
		function execute(debugState, args, env) {
			//TODO: use $http POST /debug/:debugId/execute
			return $q.resolve(new Execution(0, 'process', 'done', 10, {nextExecution: 1}));
		}

		/*** Executions ***/
		function getExecution(debugState, id) {
			//TODO: use $http GET /debug/:debugId/executions/:executionId
			return $q.resolve(new Execution(1, 'function', 'done', 10, {sourceFunction: new SourceFunction(0, 'helloFunc')}));
		}

		function getExecutionTrace(debugState, executionId) {
			//TODO: use $http GET /debug/:debugId/executions/:executionId/trace (with streaming api)
			if(executionId === 0) {
				return $q.resolve([
					new Trace(0, 1, 0, {output: 'print 1'}),
					new Trace(1, 1, 2, {output: 'print 2'}),
					new Trace(2, 2, 3, {cause: 'breakpoint', nextExecution: 1})
				]);
			}
			else if(executionId === 1) {
				return $q.resolve([
					new Trace(0, 0, 4, {state: [{variable: 0, value: 1}]}),
					new Trace(1, 0, 5, {state: [{variable: 0, value: 2}]}),
					new Trace(2, 1, 6, {output: '2'}),
					new Trace(3, 2, 7, {cause: 'ended', returnValue: 3})
				]);
			}
			else {
				return $q.reject(new SpiceError(0, 'NotFoundError', 'Execution not found'));
			}
		}

		return {
		};
	}]);
