angular.module('Spice')
	.factory('FilesystemService', ['$q', '$http', 'SpiceError', function($q, $http, SpiceError){

		/*** Constructors ***/

		function getFileContents(path) {
			//TODO: use $http GET /files/:path*
			if(path === 'hello.cpp') {
				return $q.resolve(
					'function main() {\n' +
					'	printf("print 1");\n' +
					'	printf("print 2");\n' +
					'	helloFunc(1);\n' +
					'	return 0;\n' +
					'}\n' +
					'\n' +
					'function helloFunc(int a) {\n' +
					'	a *= 2;\n' +
					'	std::string str = "hello";\n' +
					'	printf("%d", a*2);\n' +
					'	return a*2 + 1;\n' +
					'}\n'
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
