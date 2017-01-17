angular.module('Spice')
    .controller('LauncherCtrl', ['$scope', '$interval', 'DebuggerService', function ($scope, $interval, DebuggerService) {

        var self = this;
        var loadingBinary = false;

        self.loadingError = '';

        self.nobinary = true;

        self.getDisableLaunch = function() {
          return self.nobinary || loadingBinary;
        };

        //var path = 'C:/Users/Russell/Desktop/debug-c/x64/Debug/binary-search.exe';
        //var path = 'C:/Users/Elliot/Downloads/binary-search/x64/Debug/binary-search.exe';
        var path = 'C:/Users/tarik/Documents/visual_studio_2015/Projects/binarySearch/x64/Debug/binarySearch.exe';
        //var path = 'C:/Users/samda/Desktop/binary-search/x64/Debug/binary-search.exe';

        self.launchSelected = function () {
            loadingBinary = true;
            $scope.loader.Enable();

            DebuggerService.attachBinary(path)
                .then(function () {
                    $scope.$emit('changeView', 'configuration');
                    loadingBinary = false;
                    $scope.loader.Disable();
                }).catch(function(err) {
                    console.error(err);
                    self.loadingError = 'Error attaching to binary, see console.';
                    $scope.loader.Disable();
                    loadingBinary = false;
                });
        };
    }])
    .directive('spiceLauncher', function () {
        return {
            restrict: 'E',
            scope: {
                loader: '=loader'
            },
            templateUrl: 'modules/launcher/launcherTemplate.html'
        }
    });
