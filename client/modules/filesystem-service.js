angular.module('Spice')
	.factory('FilesystemService', ['$q', '$http', 'SpiceError', function($q, $http, SpiceError){

		/*** Constructors ***/

		function getFileContents(path) {
			//TODO: use $http GET /files/:path*
			if(path === 'binary-search.c') {
				return $q.resolve(
                    '#include <stdio.h>\n' +
                    'int binarySearch(int key, int *array, int length);\n' +
                    'int mergeSort(int* array);\n' +
                    'int quickSort(int* array);\n' +
                    '\n' +
                    'int main(int argc, char *argv[]) {\n' +
                    '   int array[] = { 1, 3, 4, 6, 7, 9, 11, 15 };\n' +
                    '   printf("%d\\n", binarySearch(7, array, sizeof(array) / sizeof(*array)));\n' +
                    '   \n' +
                    '   return 0;\n' +
                    '}\n' +
                    '\n\n' +
                    'int binarySearch(int key, int *array, int length) {\n' +
                    '    int low = 0;\n' +
                    '    int high = length - 1;\n' +
                    '\n\n' +
                    '    while (low <= high) {\n' +
                    '        int mid = low + (high - low) / 2;\n' +
                    '        int value = array[mid];\n' +
                    '\n\n' +
                    '        if (value < key) {\n' +
                    '            low = mid + 1;\n' +
                    '        } else if (value > key) {\n' +
                    '            high = mid - 1;\n' +
                    '        } else {\n' +
                    '            return mid;\n' +
                    '        }\n' +
                    '    }\n' +
                    '    return -1;\n' +
                    '}'
				);
			}
			else {
				return $q.reject(new SpiceError(0, 'NotFoundError', 'FilesystemService: getFileContents: File ' + path + ' not found', {path: path}));
			}
		}

		return {
			getFileContents: getFileContents
		};
	}]);
