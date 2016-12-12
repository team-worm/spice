angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope', '$timeout', '$interval', 'FilesystemService', 'DebuggerService', function ($scope, $timeout, $interval, FilesystemService, DebuggerService) {

        var self = this;

        var running = false;

        self.selectedFunction = '';

        self.FunctionList = ['main (int,char*[])', 'binarySearch (int,int*,int)', 'binary-search.c'];

        self.lines = [];

        DebuggerService.getFunctions().then(function(functions) {
            self.FunctionList = functions;
            self.error = '';
            init();
        }).catch(function(err) {
            self.error = 'Error loading functions from binary, see console.';
        });

        function init() {

            FilesystemService.getFileContents('binary-search.c').then(function (file) {
                self.lines = file.split('\n').map(function (line) {
                    return {code: line};
                });
            }, function (error) {
                alert('Failed to get file');
                console.error(error);
            });
        }

        self.getCanRunFunction = function() {
            return !running && self.selectedFunction == 'binarySearch (int,int*,int)';
        };
        self.getCanKillFunction = function() {
            return false;
        };
        self.setFunctionToRun = function(func) {
            self.selectedFunction = func;
            if(func != 'binarySearch (int,int*,int)') {
                self.error = 'Cannot run this function in the prototype.';
            } else {
                self.error = '';
            }
        };

        self.runFunction = function () {
            running = true;
            $scope.loader.Enable();

            DebuggerService.setBreakpoint(self.selectedFunction)
                .then(function() {
                    $scope.$emit('changeView', 'debugging');
                    running = false;
                    $scope.loader.Disable();
                }).catch(function(err) {
                    console.error(err);
                    running = false;
                $scope.loader.Disable();
                    self.error = 'Could not set breakpoint on function, see console.';

                });
        };

        self.killFunction = function () {
            running = false;
            $scope.loader.Disable();

        };
    }])
    .directive('spiceFunctionPicker', function () {
        return {
            restrict: 'E',
            scope: {
                loader: '=loader'
            },
            templateUrl: 'modules/functionPicker/functionPickerTemplate.html'
        }
    });
