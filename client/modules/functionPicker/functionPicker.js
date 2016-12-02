angular.module('Spice')
    .controller('FunctionPickerCtrl', ['$scope',function($scope) {

        var self = this;

        var func = function(name, arguments, file, line) {
            this.name = name;
            this.arguments = arguments;
            this.file = file;
            this.line = line;
        };

        self.FunctionList = ['binary_search', 'insertion_sort', 'binary-search.c']

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
    }])
    .directive('spiceFunctionPicker', function() {
        return {
            restrict: 'E',
            templateUrl: 'modules/functionPicker/functionPickerTemplate.html'
        }
    });
