	angular.module('Spice')
	.controller('LauncherCtrl', ['$scope', 'DebuggerService', function($scope, DebuggerService){
		$scope.nobinary = true;
		$scope.binClicked = function () {
			$scope.nobinary = false;
		}

		/* Stream example code
		var stream = new DebuggerService.Stream();
		stream.write(1);
		var read1 = stream.read(function(data) { console.log('a got ' + data); });
		read1.done.then(function() { console.log('a done'); });
		stream.write(2);
		stream.read(function(data) { console.log('b got ' + data); })
			.done.then(function() { console.log('b done'); });

		stream.write(3);
		stream.cancelRead(read1.id);
		stream.write(4);

		stream.close();
		*/

		/* Debugger example code
		var followExecution = function(executionId) {
			var nextExecutionId = null;
			return DebuggerService.getTrace(executionId)
				.then(function(traceStream) {
					return traceStream.read(function(trace) {
						console.log('Execution ' + executionId + ': ', trace.data);
					if(trace.tType === 2) {
						switch(trace.data.cause) {
							case 'breakpoint':
								nextExecutionId = trace.data.nextExecution;
								break;
						}
					}
				}).done.then(function() {
					if(nextExecutionId) {
						return followExecution(nextExecutionId);
					}
				});
			});
		}

		DebuggerService.attachBinary('hello')
			.then(function(debugState) {
				console.log('debugState: ', debugState);
				return DebuggerService.getFunctions();
			}).then(function(functions) {
				console.log('functions: ', functions);
				return DebuggerService.getBreakpoints();
			}).then(function(breakpoints) {
				console.log('breakpoints: ', breakpoints);
				console.log('execute program...');
				return DebuggerService.execute('', '');
			}).then(function(execution) {
				return followExecution(execution.id);
			}).then(function() {
				console.log('execute function 0');
				return DebuggerService.executeFunction(0, {});
			}).then(function(execution) {
				return followExecution(execution.id);
			});
		*/

	}])
	.directive('spiceLauncher', function() {
		return {
			restrict: 'E',
			scope: {
				mode: '='
			},
			templateUrl: 'modules/launcher/launcherTemplate.html'
		}
	});
