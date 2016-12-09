angular.module('Spice')
    .factory('DebuggerService', ['$q', '$http', 'SpiceError', 'Stream', function($q, $http, SpiceError, Stream){

        /*** Constructors ***/

        /***
         * A GUID uniquely identifying a debugging session.
         * @typedef {string} DebugId
         */

        /***
         * A GUID uniquely identifying a running execution.
         * @typedef {string} ExecutionId
         */

        /***
         * A GUID uniquely identifying a variable in a running program.
         * @typedef {string} VariableId
         */

        /***
         * A GUID uniquely identifying a function.
         * @typedef {string} FunctionId
         */


        /**
         * @constructor
         * @param {DebugId} id
         */
        var DebugState = function(id) {
            this.id = id;

            this.executions = {}; // map[executionId]Execution
            this.breakpoints = {}; //map[address]Breakpoint
            this.functions = {}; // map[address]SourceFunction
            this.variables = {}; // map[id]Variable
        };

        /**
         * @constructor
         * @param {ExecutionId} id
         * @param {string} eType
         * @param {string} status
         * @param {number} executionTime
         * @param {object} data
         */
        var Execution = function(id, eType, status, executionTime, data) {
            this.id = id;
            this.eType = eType;
            this.status = status;
            this.executionTime = executionTime;
            this.data = data;

            this.trace = null;

        };

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
        };

        /**
         * @constructor
         * @param {number} address
         * @param {string} name
         * @param {string} sourcePath
         * @param {number} lineNumber
         * @param {number} lineCount
         * @param {object} parameters
         * @param {object} localVariables
         */
        var SourceFunction = function(address, name, sourcePath, lineNumber, lineCount, parameters, localVariables) {
            this.address = address;
            this.name = name;
            this.sourcePath = sourcePath;
            this.lineNumber = lineNumber;
            this.lineCount = lineCount;
            this.parameters = parameters;
            this.localVariables = localVariables;
        };

        /**
         * @constructor
         * @param {VariableId} id
         * @param {string} name
         * @param {SourceType} sType
         * @param {number} address
         */
        var SourceVariable = function(id, name, sType, address) {
            this.id = id;
            this.name = name;
            this.sType = sType;
            this.address = address;
        };

        /**
         * TODO: make this not a placeholder type
         * @constructor
         * @param {string} name
         */
        var SourceType = function(name) {
            this.name = name;
        };

        /**
         * @constructor
         * @param {FunctionId} functionId
         * @param {object} metadata
         */
        var Breakpoint = function(functionId, metadata) {
            this.functionId = functionId;
            this.metadata = metadata;
        };

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
                        // register variables in lookup
                        func.parameters.concat(func.localVariables).forEach(function(variable) {
                            attachedDebugState.variables[variable.id] = variable;
                        });
                        return fs;
                    }, {});
                    return attachedDebugState.functions;
                });
        }

        /**
         * @param {functionId} id
         * @returns {Promise<SourceFunction>}
         */
        function getFunction(id) {
            if(attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _getFunction(attachedDebugState, id)
                .then(function(func) {
                    attachedDebugState.functions[func.address] = func;
                    // register variables in lookup
                    func.parameters.concat(func.localVariables).forEach(function(variable) {
                        attachedDebugState.variables[variable.id] = variable;
                    });
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
                    attachedDebugState.breakpoints[breakpoint.function.address] = breakpoint;
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
                    delete attachedDebugState.breakpoints[functionId];
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
         * @returns {Promise<DebugState>}
         */
        function _attachBinary(path) {
            //TODO: use $http POST /debug/attach/bin/:path*
            //VERIFY

            return $http({
                method: 'POST',
                url: 'http://localhost:3000/api/v1/debug/attach/bin/'+path,
                data: {}
            })
                .then(function(response){ //Success
                    var debugInfo = response.data;
                    return new DebugState(debugInfo.id)
                }, function(response) { //Error
                    throw new SpiceError(response.code,response.name,response.message,response.data)
                });

            //return $q.resolve(new DebugState(0));

        }

        /**
         * @param {DebugState} debugState
         * @param {string} arguments
         * @param {string} environmentVars
         * @returns {Promise<Execution>}
         */
        function _execute(debugState, arguments, environmentVars) {
            //TODO: use $http POST /debug/:debugId/execute
            //VERIFY

            var reqBody = {
                args: arguments,
                env: environmentVars
            };

            return $http({
                method: 'POST',
                url: 'http://localhost:3000/api/v1/debug/'+debugState.id+'/execute',
                data: reqBody
            })
                .then(function(response){ //Success
                    var execution = response.data;
                    return new Execution(execution.id,execution.eType,execution.status, execution.executionTime, execution.data)
                }, function(response) { //Error
                    throw new SpiceError(response.code,response.name,response.message,response.data)
                });


            //return $q.resolve(new Execution(0, 'process', 'done', 10, {nextExecution: 1}));
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
            //VERIFY

            var deferred = $q.defer();

            $http({
                method: 'GET',
                url: 'http://localhost:3000/api/v1/debug/'+debugState.id+'/functions'
            })
                .then(function(response){ //Success
                    var execution = response.data;
                    deferred.resolve(execution);
                }, function(response) { //Error
                    deferred.reject(response.data);
                });

            return deferred.promise;

            // return $q.resolve(
            // 	[new SourceFunction(0, 'helloFunc', 'hello.cpp', 4, 4, [new SourceVariable(0, 'a', new SourceType('int'), 0),
            // 	new SourceVariable(1, 'b', new SourceType('int'), 1)], [new SourceVariable(2, 'i', new SourceType('int'), 2)])]);
        }

        function _getFunction(debugState, id) {
            //TODO: use $http GET /debug/:debugId/functions/:function
            if(id === 0) {
                return $q.resolve([new SourceFunction(0, 'helloFunc', 'hello.cpp', 4, 4, [new SourceVariable(0, 'a', new SourceType('int'), 0),
                    new SourceVariable(1, 'b', new SourceType('int'), 1)], [new SourceVariable(2, 'i', new SourceType('int'), 2)])]);
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

            var deferred = $q.defer();

            $http({
                method: 'PUT',
                url: 'http://localhost:3000/api/v1/debug/'+debugState.id+'/breakpoints/'+functionId
            })
                .then(function(response){ //Success
                    var execution = response.data;
                    deferred.resolve(execution);
                }, function(response) { //Error
                    deferred.reject(response.data);
                });

            return deferred.promise;

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
                traceStream.write(new Trace(0, 1, 2, {output: 'print 1'}));
                traceStream.write(new Trace(1, 1, 3, {output: 'print 2'}));
                traceStream.write(new Trace(2, 2, 4, {cause: 'breakpoint', nextExecution: 1}));
            }
            else if(executionId === 1) {
                //function(a=2, b=2)
                traceStream.write(new Trace(0, 0, 8, {state: [{variable: 0, value: 2},{variable: 1, value: 2}]}));
                //for(int i = 0; i < 4; i++)
                traceStream.write(new Trace(1, 0, 9, {state: [{variable: 2, value: 0}]}));
                //b += 2
                traceStream.write(new Trace(3, 0, 10, {state: [{variable: 1, value: 4}]}));
                //if x % 2 === 0 { a *= 2 }
                traceStream.write(new Trace(4, 0, 12, {state: [{variable: 0, value: 4}]}));
                //else { a-= 1 }
                //loop
                traceStream.write(new Trace(5, 0, 9, {state: [{variable: 2, value: 1}]}));
                //b += 2
                traceStream.write(new Trace(6, 0, 10, {state: [{variable: 1, value: 6}]}));
                //if x % 2 === 0 { a *= 2 }
                //else { a-= 1 }
                traceStream.write(new Trace(7, 0, 14, {state: [{variable: 0, value: 3}]}));
                //loop
                traceStream.write(new Trace(8, 0, 9, {state: [{variable: 2, value: 2}]}));
                //b += 2
                traceStream.write(new Trace(9, 0, 10, {state: [{variable: 1, value: 8}]}));
                //if x % 2 === 0 { a *= 2 }
                traceStream.write(new Trace(10, 0, 12, {state: [{variable: 0, value: 6}]}));
                //else { a-= 1 }
                //loop
                traceStream.write(new Trace(11, 0, 9, {state: [{variable: 2, value: 3}]}));
                //b += 2
                traceStream.write(new Trace(12, 0, 10, {state: [{variable: 1, value: 10}]}));
                //if x % 2 === 0 { a *= 2 }
                //else { a-= 1 }
                traceStream.write(new Trace(13, 0, 14, {state: [{variable: 0, value: 5}]}));
                //end loop
                //b /= 2
                traceStream.write(new Trace(14, 0, 16, {state: [{variable: 1, value: 5}]}));
                // return a + b
                traceStream.write(new Trace(15, 2, 17, {cause: 'ended', returnValue: 10}));

                //traceStream.write(new Trace(0, 0, 8, {state: [{variable: 0, value: 1}]}));
                //traceStream.write(new Trace(1, 0, 9, {state: [{variable: 0, value: 2}]}));
                //traceStream.write(new Trace(2, 0, 10, {state: [{variable: 1, value: 'hello'}]}));
                //traceStream.write(new Trace(3, 1, 11, {output: '2'}));
                //traceStream.write(new Trace(4, 0, 9, {state: [{variable: 0, value: 3}]}));
                //traceStream.write(new Trace(5, 0, 10, {state: [{variable: 1, value: 'hello'}]}));
                //traceStream.write(new Trace(6, 1, 11, {output: '2'}));
                //traceStream.write(new Trace(7, 0, 9, {state: [{variable: 0, value: 3}]}));
                //traceStream.write(new Trace(8, 0, 10, {state: [{variable: 1, value: 'hello'}]}));
                //traceStream.write(new Trace(9, 1, 11, {output: '2'}));
                //traceStream.write(new Trace(10, 2, 12, {cause: 'ended', returnValue: 3}));
            }
            else if(executionId === 2) {
                traceStream.write(new Trace(0, 0, 8, {state: [{variable: 0, value: 2}]}));
                traceStream.write(new Trace(1, 0, 9, {state: [{variable: 0, value: 4}]}));
                traceStream.write(new Trace(2, 0, 10, {state: [{variable: 1, value: 'hello'}]}));
                traceStream.write(new Trace(3, 1, 11, {output: '8'}));
                traceStream.write(new Trace(4, 2, 12, {cause: 'ended', returnValue: 9}));
            }
            else {
                throw new SpiceError(0, 'NotFoundError', 'Execution ' + executionId + ' not found', {id: executionId});
            }
            traceStream.close();
            return traceStream;
        }

        return {
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
