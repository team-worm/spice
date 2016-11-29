angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope',function($scope) {
        $scope.test = 'Read to code Function Picker.'
    }])
    .directive('spiceFunctionPicker', function() {
        return {
            restrict: 'E',
            templateUrl: 'modules/functionPicker/functionPickerTemplate.html'
        }
    });
