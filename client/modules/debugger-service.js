angular.module('Spice')
    .factory('DebuggerService', ['$q', '$http', 'SpiceError', 'Stream', function ($q, $http, SpiceError, Stream) {


        var HOST = 'http://localhost:3000';

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
        var DebugState = function (id) {
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
        var Execution = function (id, eType, status, executionTime, data) {
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
        var Trace = function (index, tType, line, data) {
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
        var SourceFunction = function (address, name, sourcePath, lineNumber, lineCount, parameters, localVariables) {
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
        var SourceVariable = function (id, name, sType, address) {
            //TODO: use id as id instead of name
            this.id = name;
            this.name = name;
            this.sType = sType;
            this.address = address;
        };

        /**
         * TODO: make this not a placeholder type
         * @constructor
         * @param {string} name
         */
        var SourceType = function (name) {
            this.name = name;
        };

        /**
         * @constructor
         * @param {FunctionId} functionId
         * @param {object} metadata
         */
        var Breakpoint = function (functionId, metadata) {
            this.functionId = functionId;
            this.metadata = metadata;
        };

        /** Current State
         * @type {DebugState} */
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
                .then(function (state) {
                    attachedDebugState = state;
                    return attachedDebugState;
                });
        }

        /**
         * @returns {Promise<map[functionId]SourceFunction>}
         */
        function getFunctions() {
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _getFunctions(attachedDebugState)
                .then(function (functions) {
                    attachedDebugState.functions = functions.reduce(function (fs, func) {
                        fs[func.address] = func;
                        // register variables in lookup
                        func.parameters.concat(func.localVariables).forEach(function (variable) {
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
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _getFunction(attachedDebugState, id)
                .then(function (func) {
                    attachedDebugState.functions[func.address] = func;
                    // register variables in lookup
                    func.parameters.concat(func.localVariables).forEach(function (variable) {
                        attachedDebugState.variables[variable.id] = variable;
                    });
                    return func;
                });
        }

        /**
         * @returns {Promise<map[functionId]Breakpoint>}
         */
        function getBreakpoints() {
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _getBreakpoints(attachedDebugState)
                .then(function (breakpoints) {
                    attachedDebugState.breakpoints = breakpoints.reduce(function (bs, breakpoint) {
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
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _setBreakpoint(attachedDebugState, functionId)
                .then(function (breakpoint) {
                    attachedDebugState.breakpoints[breakpoint.functionId] = breakpoint;
                    return breakpoint;
                });
        }

        /**
         * @param {FunctionId} functionId
         * @returns {Promise<Breakpoint>}
         */
        function removeBreakpoint(functionId) {
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _removeBreakpoint(attachedDebugState, functionId)
                .then(function () {
                    delete attachedDebugState.breakpoints[functionId];
                });
        }

        /**
         * @param {string} args
         * @param {string} env
         * @returns {Promise<Execution>}
         */
        function execute(args, env) {
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _execute(attachedDebugState, args, env)
                .then(function (execution) {
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
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return _executeFunction(attachedDebugState, functionId, parameters)
                .then(function (execution) {
                    attachedDebugState.executions[execution.id] = execution;
                    return execution;
                });
        }

        /**
         * @param {ExecutionId} id
         * @returns {Promise<Stream>}
         */
        function getTrace(id) {
            if (attachedDebugState === null) {
                return $q.reject(new SpiceError(0, 'NotAttachedError', 'Not currently attached to a process'));
            }

            return $q.resolve(attachedDebugState.executions[id])
                .then(function (execution) {
                    if (execution) {
                        return execution;
                    }
                    else {
                        return _getExecution(attachedDebugState, id)
                            .then(function (ex) {
                                attachedDebugState.executions[ex.id] = ex;
                                return ex;
                            });
                    }
                }).then(function (execution) {
                    if (execution.trace) {
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
            return $http({
                method: 'POST',
                url: HOST + '/api/v1/debug/attach/bin/' + path,
                data: {}
            }).then(function (response) {
                var debugInfo = response.data;
                return new DebugState(debugInfo.id);
            }).catch(function (err) {
                throw new SpiceError(0, '', err.message, err.data);
            });
        }

        /**
         * @param {DebugState} debugState
         * @param {string} arguments
         * @param {string} environmentVars
         * @returns {Promise<Execution>}
         */
        function _execute(debugState, args, environmentVars) {
            var reqBody = {
                args: args,
                env: environmentVars
            };

            return $http({
                method: 'POST',
                url: HOST + '/api/v1/debug/' + debugState.id + '/execute',
                data: reqBody
            })
                .then(function (response) { //Success
                    var execution = response.data;
                    return new Execution(execution.id, execution.eType, execution.status, execution.executionTime, execution.data)
                }).catch(function (err) {
                    throw new SpiceError(0, '', err.message, err);
                });
        }

        /**
         * @param {DebugState} debugState
         * @param {FunctionId} functionId
         * @param {object} parameters
         * @returns {Promise<Execution>}
         */
        function _executeFunction(debugState, functionId, parameters) {
            //TODO: use $http POST /debug/:debugId/functions/:function/execute
            if (functionId === 0) {
                return $q.resolve(new Execution(2, 'function', 'done', 10, {sourceFunction: 0}));
            }
            else {
                return $q.reject(new SpiceError(0, 'NotFoundError', 'Function ' + id + ' not found', {id: id}));
            }
        }

        /*** SourceFunctions ***/
        function _getFunctions(debugState) {
            return $http({
                method: 'GET',
                url: HOST + '/api/v1/debug/' + debugState.id + '/functions'
            }).then(function (response) { //Success
                return response.data.map(function (func) {
                    return new SourceFunction(func.address, func.name, func.sourcePath, func.lineNumber, func.lineCount,
                        func.parameters.map(function (variable) {
                            return new SourceVariable(variable.id, variable.name, new SourceType(variable.sType), variable.address);
                        }), func.localVariables.map(function (variable) {
                            return new SourceVariable(variable.id, variable.name, new SourceType(variable.sType), variable.address);
                        }));
                });
            }).catch(function (err) {
                throw new SpiceError(0, '', err.message, err);
            });
        }

        function _getFunction(debugState, id) {
            return $http({
                method: 'GET',
                url: HOST + '/api/v1/debug/' + debugState.id + '/functions' //TODO: use the actual get function endpoint
            }).then(function (response) { //Success
                var func = response.data[0];
                return new SourceFunction(func.address, func.name, func.sourcePath, func.lineNumber, func.lineCount,
                    func.parameters.map(function (variable) {
                        return new SourceVariable(variable.id, variable.name, new SourceType(variable.sType), variable.address);
                    }), func.localVariables.map(function (variable) {
                        return new SourceVariable(variable.id, variable.name, new SourceType(variable.sType), variable.address);
                    })
                );
            }).catch(function (err) {
                throw new SpiceError(0, '', err.message, err);
            });
        }

        /*** Breakpoints **/

        function _getBreakpoints(debugState) {
            //TODO: use $http GET /debug/:debugId/breakpoints
            return $q.resolve([new Breakpoint(0, {})]);
        }

        function _setBreakpoint(debugState, functionId) {
            return $http({
                method: 'PUT',
                url: HOST + '/api/v1/debug/' + debugState.id + '/breakpoints/' + functionId
            })
                .then(function (response) { //Success
                    return new Breakpoint(response.data.function.address, response.data.metadata);
                }).catch(function (err) { //Error
                    throw new SpiceError(0, '', err.message, err);
                });
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
            if (id === 0) {
                return $q.resolve(new Execution(0, 'process', 'done', 10, {nextExecution: 1}));
            }
            else if (id === 1) {
                return $q.resolve(new Execution(1, 'function', 'done', 10, {sourceFunction: 5368780704}));
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
            var traceStream = new Stream();
            $http({
                method: 'GET',
                url: HOST + '/api/v1/debug/' + debugState.id + '/executions/' + executionId + '/trace'
            }).then(function (response) { //Success
                response.data.forEach(function (trace) {
                    var t = new Trace(trace.index, trace.tType, trace.line, trace.data);
                    traceStream.write(t);
                });
                traceStream.close();
            }).catch(function (response) { //Error
                throw new SpiceError(0, 'NotFoundError', response.data.message, response.data);
            });
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
