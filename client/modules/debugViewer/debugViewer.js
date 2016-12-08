angular.module('Spice')
	.controller('DebugViewerCtrl', ['$scope', '$timeout', 'DebuggerService', 'FilesystemService', function($scope, $timeout, DebuggerService, FilesystemService) {
		$scope.lines = [];

		//$scope.lines = [
			//{ code: 'void insertion_sort (int arr[], int length){', state: 'a=1' },
			//{ code: '		int j, temp;', state: 'a=1' },
			//{ code: '		', state: 'a=1' },
			//{ code: '	for (int i = 0; i < length; i++){', state: 'a=1' },
			//{ code: '		j = i;', state: 'a=1' },
			//{ code: '		', state: 'a=1' },
			//{ code: '		while (j > 0 && arr[j] < arr[j-1]){', state: 'a=1' },
			//{ code: '			temp = arr[j];', state: 'a=1' },
			//{ code: '			arr[j] = arr[j-1];', state: 'a=1' },
			//{ code: '			arr[j-1] = temp;', state: 'a=1' },
			//{ code: '			j--;', state: 'a=1' },
			//{ code: '			}', state: 'a=1' },
			//{ code: '		}', state: 'a=1' },
			//{ code: '}', state: 'a=1' }
		//];

		//$timeout(function() {
			////after the page renders, redigest so the ReactiveHeightCells can set height
			//$scope.$digest()
		//});

		//0 | 1 2
		//0 | 1
		//
		//0,0
		
		$scope.traceColCount = 0;
		$scope.currentTraceCol = -1;
		$scope.addTrace = function(trace) {
			var line = $scope.lines[trace.line-1];
			if(line.traceMaxIteration >= $scope.currentTraceCol) {
				line.traceMaxIteration++;
				$scope.currentTraceCol = line.traceMaxIteration;
			}

			line.traces[$scope.currentTraceCol] = trace;
			if(line.traceMaxIteration < $scope.currentTraceCol) {
				line.traceMaxIteration = $scope.currentTraceCol;
			}

			if($scope.currentTraceCol >= $scope.traceColCount) {
				$scope.traceColCount = $scope.currentTraceCol + 1;
			}
		}

		FilesystemService.getFileContents('binary-search.c')
			.then(function(contents) {
				$scope.lines = contents.split('\n').map(function(line) {
					return { code: line, traces: [], traceMaxIteration: -1};
				});
			});


		//var path = 'C:/Users/Russell/Desktop/debug-c/x64/Debug/binary-search.exe';

		var path = 'C:/Users/samda/Desktop/binary-search/x64/Debug/binary-search.exe';

		DebuggerService.attachBinary(path)
			.then(function(debugState) {
				console.log(debugState);
				return DebuggerService.getFunctions();
			}).then(function(functions) {
				return DebuggerService.setBreakpoint('140695859763088');
			}).then(function(breakpoints) {
				return DebuggerService.execute('', '');
			}).then(function(execution) {
				return followExecution(execution.id);
			//}).then(function() {
				//return DebuggerService.executeFunction(0, {});
			//}).then(function(execution) {
				//return followExecution(execution.id);
			});

		function followExecution(executionId) {
			var nextExecutionId = null;
			return DebuggerService.getTrace(executionId)
				.then(function(traceStream) {
					return traceStream.read(function(trace) {
						//console.log('Execution ' + executionId + ': ', trace.data);
						$scope.addTrace(trace);
						switch(trace.tType) {
							case 0:
							case 1:
								//$scope.lines[trace.line].traces.push(trace);
								break;
							case 2:
							switch(trace.data.cause) {
								//case 'ended':
									//$scope.lines[trace.line].trace.push(trace);
									//break;
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

	}])
	.directive('spiceDebugViewer', function() {
		return {
			restrict: 'E',
			templateUrl: 'modules/debugViewer/debugViewerTemplate.html'
		}
	}).directive('reactiveHeightGrid', function() {
		return {
			restrict: 'E',
			transclude: true,
			scope: {},
			controller: ['$scope', '$element', '$transclude', function($scope, $element, $transclude) {
				$transclude(function(clone, scope) {
					$element.append(clone);
				});

				$scope.cells = {}; //{cols: Cell[], max: int}[]
				this.registerCell = function(row, col, cell) {
					if(!$scope.cells[row]) {
						$scope.cells[row] = { cols: [], max: 0 };
					}

					$scope.cells[row].cols[col] = cell;
					this.onCellHeightUpdated(row, col);
				};

				this.unregisterCell = function(row, col) {
					if($scope.cells[row] && $scope.cells[row].cols[col]) {
						delete $scope.cells[row].cols[col];
						this.onCellHeightUpdated(row, col);
					}
					else {
						throw new Error('reactiveHeightGrid: unregisterCell: Cell does not exist');
					}
				};

				this.onCellHeightUpdated = function(row, col) {
					if($scope.cells[row]) {
						var max = Math.max.apply(null, $scope.cells[row].cols.map(function(cell) {
							return cell.height;
						}));
						$scope.cells[row].max = max;
						$scope.cells[row].cols.forEach(function(cell) {
							cell.setMaxHeight(max);
						});
					}
					else {
						throw new Error('reactiveHeightGrid: updateCellHeight: Cell does not exist');
					}
				};
			}]
		};
	}).directive('reactiveHeightCell', function() {
		return {
			require: '^^reactiveHeightGrid',
			restrict: 'E',
			transclude: true,
			template: '<div ng-transclude class="reactive-height-cell" layout="row" layout-align="none center"></div>',
			scope: {
				row: '=',
				col: '='
				
			},
			link: function(scope, elem, attrs, gridCtrl) {
				scope.cell = { height: outerHeight(elem.children()[0]) };
				scope.cell.maxHeight = 0;

				scope.cell.setMaxHeight = function(height) {
					scope.cell.maxHeight = height;
					elem.children().css({height: height + 'px'});
				};

				gridCtrl.registerCell(scope.row, scope.col, scope.cell);

				scope.$watch(function() {
					elem.children().css({height: ""});
					scope.cell.height = outerHeight(elem.children()[0]);
					if(scope.cell.maxHeight > 0) {
						elem.children().css({height: scope.cell.maxHeight + 'px'});
					}
					gridCtrl.onCellHeightUpdated(scope.row, scope.col);
				});

				elem.on('$destroy', function() {
					gridCtrl.unregisterCell(scope.row, scope.col);
				});
			}
		};
	}).directive('trace', ['DebuggerService', function(DebuggerService) {
		return {
			restrict: 'E',
			scope: {
				trace: '='
			},
			templateUrl: 'modules/debugViewer/traceTemplate.html',
			link: function(scope, elem, attrs) {
				scope.getVariable = function(id) {
					//TODO: create debuggerService function to do this
					return DebuggerService.getAttachedDebugState().variables[id];
				};
			}
		};
	}]);

function outerHeight(el) {
	var height = el.offsetHeight;
	var style = getComputedStyle(el);

	height += parseInt(style.marginTop) + parseInt(style.marginBottom);
	return height;
}
