angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope', '$timeout', '$interval', 'FilesystemService', function($scope, $timeout, $interval, FilesystemService) {

        var self = this;

        $timeout(function() {
            //after the page renders, redigest so the ReactiveHeightCells can set height
            $scope.$digest()
        });

        $interval(function() {
            if(self.running && $scope.mockloader.progress < 100) {

                $scope.mockloader.progress+= 5 ;
                if($scope.mockloader.progress == 5) {
                    $scope.$emit('changeView','debugging');
                }
            }
            if($scope.mockloader.progress >= 100) {
                $scope.mockloader.progress = 0;
                self.running = 0;
            }

        },100, 0, false);

        self.selectedFunction = '';

        self.FunctionList = ['main (int,char*)', 'binarySearch (int,int*,int)', 'binary-search.c'];

        // Just insert some other garbage for the mockup.
        for(var i = 0; i < 10; i++) {
            self.FunctionList.push('some_other_function_'+i+' ()');
        }

        self.running = false;

        self.lines = [];

        FilesystemService.getFileContents('binary-search.c').then(function(file) {
            self.lines = file.split('\n').map(function(line) {
                return { code: line };
            });
        }, function(error) {
            alert('Failed to get file');
            console.error(error);
        });

        self.runFunction = function() {
            self.running = true
        };

        self.killFunction = function() {
            self.running = false
            $scope.mockloader.progress = 0
        };
    }])
    .directive('spiceFunctionPicker', function() {
        return {
            restrict: 'E',
            scope: {
                mockloader: '=mockloader'
            },
            templateUrl: 'modules/functionPicker/functionPickerTemplate.html'
        }
    });
