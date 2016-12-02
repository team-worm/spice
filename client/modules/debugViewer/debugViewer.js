angular.module('Spice')
	.controller('DebugViewerCtrl', ['$scope', '$timeout', function($scope, $timeout) {
		$scope.lines = [
			{ code: 'void insertion_sort (int arr[], int length){', state: 'a=1' },
			{ code: '		int j, temp;', state: 'a=1' },
			{ code: '		', state: 'a=1' },
			{ code: '	for (int i = 0; i < length; i++){', state: 'a=1' },
			{ code: '		j = i;', state: 'a=1' },
			{ code: '		', state: 'a=1' },
			{ code: '		while (j > 0 && arr[j] < arr[j-1]){', state: 'a=1' },
			{ code: '			temp = arr[j];', state: 'a=1' },
			{ code: '			arr[j] = arr[j-1];', state: 'a=1' },
			{ code: '			arr[j-1] = temp;', state: 'a=1' },
			{ code: '			j--;', state: 'a=1' },
			{ code: '			}', state: 'a=1' },
			{ code: '		}', state: 'a=1' },
			{ code: '}', state: 'a=1' }

		];

		$timeout(function() {
			//after the page renders, redigest so the ReactiveHeightCells can set height
			$scope.$digest()
		});
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
						if(max !== $scope.cells[row].max) {
							$scope.cells[row].max = max;
							$scope.cells[row].cols.forEach(function(cell) {
								cell.setMaxHeight(max);
							});
						}
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
				scope.cell.maxHeight = scope.cell.height;

				scope.cell.setMaxHeight = function(height) {
					scope.cell.maxHeight = height;
					elem.children().css({height: height + 'px'});
				};

				gridCtrl.registerCell(scope.row, scope.col, scope.cell);

				scope.$watch(function() {
					elem.children().css({height: ""});
					scope.cell.height = outerHeight(elem.children()[0]);
					elem.children().css({height: scope.cell.maxHeight + 'px'});
					gridCtrl.onCellHeightUpdated(scope.row, scope.col);
				});

				elem.on('$destroy', function() {
					gridCtrl.unregisterCell(scope.row, scope.col);
				});
			}
		};
	});

function outerHeight(el) {
	var height = el.offsetHeight;
	var style = getComputedStyle(el);

	height += parseInt(style.marginTop) + parseInt(style.marginBottom);
	return height;
}
