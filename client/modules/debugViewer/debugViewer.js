angular.module('Spice')
    .controller('DebugViewerCtrl', ['$scope',function($scope) {
        $scope.test = 'Read to code Debug Viewer.'
    }])
    .directive('spiceDebugViewer', function() {
        return {
            restrict: 'E',
            templateUrl: 'modules/debugViewer/debugViewerTemplate.html'
        }
    });
