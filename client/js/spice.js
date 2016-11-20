angular.module('Spice', ['ngMaterial', 'ngMessages'])
    .controller('MainCtrl', ['$scope', '$interval', function($scope, $interval) {
        $scope.MockupText = 'I am a mockup';
        $scope.MockProcesses = ['chrome', 'firefox','slack','De St. Germain', 'Jensen'];
        $scope.MockLoader = 0;

        $interval(function() {
            $scope.MockLoader = ($scope.MockLoader+1) % 100;

        }, 100, 0 ,true)
    }])
    .config(function($mdThemingProvider) {

        // Configure a dark theme with primary foreground yellow

        $mdThemingProvider.theme('docs-dark', 'default')
            .primaryPalette('orange')
            .dark();

    });