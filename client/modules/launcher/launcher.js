angular.module('Spice')
    .controller('LauncherCtrl', ['$scope', function($scope){
        $scope.nobinary = true;
        $scope.binClicked = function () {
            $scope.nobinary = false;
        }
    }])
    .directive('spiceLauncher', function() {
       return {
           templateUrl: 'modules/launcher/launcherTemplate.html'
       }
    });
