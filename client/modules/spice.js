angular.module('Spice', ['ngMaterial', 'ngMessages'])
    .controller('MainCtrl', ['$scope', '$interval', function($scope, $interval) {

        $scope.mode = 1;

        $scope.MockLoader = 57;

        //$interval(function() {
        //    $scope.MockLoader = ($scope.MockLoader+1) % 100;
        //
        //}, 100, 0 ,true)
    }])
    .config(function($mdThemingProvider) {

        // Configure a dark theme with primary foreground yellow

        $mdThemingProvider.theme('docs-dark', 'default')
            .primaryPalette('orange')
            .dark();

});