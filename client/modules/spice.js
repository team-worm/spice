angular.module('Spice', ['ngMaterial', 'ngMessages'])
    .controller('MainCtrl', ['$scope', '$interval', function ($scope, $interval) {

        var self = this;

        self.view = 2;

        self.configUnlocked = true;
        self.debuggingUnlocked = true;

        $scope.MockLoader = {progress: 0};

        $scope.$on('changeView', function (event, viewArg) {
            if (typeof viewArg != 'string') {
                console.error('\'changeView\' event arg is not a string.', viewArg);
                return;
            }
            switch (viewArg.toLowerCase()) {
                case 'launcher':
                    self.view = 0;
                    break;
                case 'configuration':
                    self.configUnlocked = true;
                    self.view = 1;
                    break;
                case 'debugging':
                    self.debuggingUnlocked = true;
                    self.view = 2;
                    break;
                default:
                    console.error('\'changeView\' event arg is not a valid view.', viewArg);
            }
        });

        //$interval(function() {
        //    $scope.MockLoader = ($scope.MockLoader+1) % 100;
        //
        //}, 100, 0 ,true)
    }])
    .config(function ($mdThemingProvider) {

        // Configure a dark theme with primary foreground yellow

        $mdThemingProvider.theme('docs-dark', 'default')
            .primaryPalette('orange')
            .dark();

    });
