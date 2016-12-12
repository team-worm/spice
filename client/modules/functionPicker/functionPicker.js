angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope', '$timeout', '$interval', 'FilesystemService', 'DebuggerService', function ($scope, $timeout, $interval, FilesystemService, DebuggerService) {

        var self = this;

        var running = false;

        self.selectedFunction = '';

        self.FunctionList = [];

        self.lines = [];

        DebuggerService.getFunctions().then(function(functions) {
            var list = [];
            for(pr in functions) {
                if(functions.hasOwnProperty(pr)) {
                    list.push({func: functions[pr],  address: pr})
                }
            }

            self.FunctionList = list;
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

        self.getFuncPars = function(item) {
            var func = item;
            if(!func) {
                func = self.selectedFunction;
            }
            if(!func) {
                return '';
            }
            var out = '(';
            var start = true;
            func.func.parameters.map(function(par){
                if(!start) {
                    out += ',';

                }
                start = false;

                out += par.sType.name;
            });

            out += ')';

            return out;
        };

        self.getCanRunFunction = function() {
            return !!self.selectedFunction;
        };
        self.getCanKillFunction = function() {
            return false;
        };
        self.setFunctionToRun = function(func) {
            self.selectedFunction = func;
        };

        self.runFunction = function () {
            running = true;
            $scope.loader.Enable();

            DebuggerService.setBreakpoint(self.selectedFunction.address)
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
