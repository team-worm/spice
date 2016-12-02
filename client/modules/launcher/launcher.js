	angular.module('Spice')
	.controller('LauncherCtrl', ['$scope', 'DebuggerService', function($scope, DebuggerService){
		$scope.nobinary = true;
		$scope.binClicked = function () {
			$scope.nobinary = false;
		};

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
