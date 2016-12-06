angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope', '$timeout', '$interval', function($scope, $timeout, $interval) {

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

        self.FunctionList = ['binarySearch (int,int*,int)', 'binary-search.c'];

        // Just insert some other garbage for the mockup.
        for(var i = 0; i < 10; i++) {
            self.FunctionList.push('some_other_function_'+i+' ()');
        }

        self.running = false;

        self.lines = [
            {code: '#include <stdio.h>'},
            {code: 'int binarySearch(int key, int *array, int length);'},
            {code: 'int mergeSort(int* array);'},
            {code: 'int quickSort(int* array);'},
            {code: ''},
            {code: 'int main(int argc, char *argv[]) {'},
            {code: '   int array[] = { 1, 3, 4, 6, 7, 9, 11, 15 };'},
            {code: '   printf("%d\\n", binarySearch(7, array, sizeof(array) / sizeof(*array)));'},
            {code: '   '},
            {code: '   return 0;'},
            {code: '}'},
            {code: '\n'},
            {code: 'int binarySearch(int key, int *array, int length) {'},
            {code: '    int low = 0;'},
            {code: '    int high = length - 1;'},
            {code: '\n'},
            {code: '    while (low <= high) {'},
            {code: '        int mid = low + (high - low) / 2;'},
            {code: '        int value = array[mid];'},
            {code: '\n'},
            {code: '        if (value < key) {'},
            {code: '            low = mid + 1;'},
            {code: '        } else if (value > key) {'},
            {code: '            high = mid - 1;'},
            {code: '        } else {'},
            {code: '            return mid;'},
            {code: '        }'},
            {code: '    }'},
            {code: '    return -1;'},
            {code: '}'},
            {code: '\n'},
            {code: 'int mergeSort(int* array) {'},
            {code: '    //Implementation...'},
            {code: '    return 0;'},
            {code: '}'},
            {code: '\n'},
            {code: 'int quickSort(int* array) {'},
            {code: '    //Implementation...'},
            {code: '    return 0;'},
            {code: '}'}
        ];

        self.runFunction = function() {
            self.running = true
        };

        self.killFunction = function() {
            self.running = false
            $scope.mockloader.progress = 0
        }
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
