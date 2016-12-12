angular.module('Spice', ['ngMaterial', 'ngMessages'])
    .controller('MainCtrl', ['$scope', 'DebuggerService', function ($scope, DebuggerService) {

        var self = this;

        self.view = 'launcher';

        self.getConfigUnlocked = function() {
            var debugState = DebuggerService.getAttachedDebugState();
            return !!debugState;
        };
        self.getDebuggingUnlocked = function () {
            var debugState = DebuggerService.getAttachedDebugState();
            return !!debugState && Object.keys(debugState.breakpoints).length > 0;
        };

        $scope.Loader = {
            mode: 'determinate',
            Enable: function() {
                this.mode = 'indeterminate';
            },
            Disable: function() {
                this.mode = 'determinate';
            }
        };

        $scope.$on('changeView', function (event, viewArg) {
            if (typeof viewArg != 'string') {
                console.error('\'changeView\' event arg is not a string.', viewArg);
                return;
            }
            var viewLc = viewArg.toLowerCase();
            switch (viewLc) {
                case 'launcher':
                case 'configuration':
                case 'debugging':
                    self.view = viewLc;
                    break;
                default:
                    console.error('\'changeView\' view is not a valid view.', viewArg);
            }
        });
    }])
    .config(function ($mdThemingProvider) {

        // Configure a dark theme with primary foreground yellow

        $mdThemingProvider.theme('docs-dark', 'default')
            .primaryPalette('orange')
            .dark();

    });
