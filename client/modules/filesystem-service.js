angular.module('Spice')
    .factory('FilesystemService', ['$q', '$http', 'SpiceError', function ($q, $http, SpiceError) {

        /*** Constructors ***/

        function getFileContents(path) {
            //TODO: use $http GET /files/:path*
            if (path === 'binary-search.c') {
                return $q.resolve(
                    "#define _CRT_SECURE_NO_WARNINGS\n" +
                    "#include <stdio.h>\n" +
                    "#include <memory.h>\n" +
                    "\n" +
                    "size_t binarySearch(int key, int *array, size_t length);\n" +
                    "\n" +
                    "int main(int argc, char *argv[]) {\n" +
                    "	FILE *file = fopen(\"data.txt\", \"rb\");\n" +
                    "	if (file == NULL) {\n" +
                    "		return 1;\n" +
                    "	}\n" +
                    "\n" +
                    "	int array[64];\n" +
                    "	size_t length = 0;\n" +
                    "\n" +
                    "	while (length < sizeof(array) / sizeof(*array)) {\n" +
                    "		int count = fscanf(file, \"%d\", &array[length]);\n" +
                    "		if (count == EOF) {\n" +
                    "			break;\n" +
                    "		} else if (count < 1) {\n" +
                    "			return 1;\n" +
                    "		}\n" +
                    "\n" +
                    "		length += 1;\n" +
                    "	}\n" +
                    "\n" +
                    "	printf(\"%zu\\n\", binarySearch(7, array, length));\n" +
                    "\n" +
                    "	return 0;\n" +
                    "}\n" +
                    "\n" +
                    "size_t binarySearch(int key, int *array, size_t length) {\n" +
                    "	size_t low = 0;\n" +
                    "	size_t high = length - 1;\n" +
                    "\n" +
                    "	while (low <= high) {\n" +
                    "		size_t mid = low + (high - low) / 2;\n" +
                    "		int value = array[mid];\n" +
                    "\n" +
                    "		if (value < key) {\n" +
                    "			low = mid + 1;\n" +
                    "		} else if (value > key) {\n" +
                    "			high = mid - 1;\n" +
                    "		} else {\n" +
                    "			return mid;\n" +
                    "		}\n" +
                    "	}\n" +
                    "\n" +
                    "	return -1;\n" +
                    "}\n"
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
