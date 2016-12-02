angular.module('Spice')
	.factory('SpiceError', [function(){
		/**
		 * @constructor
		 * @param {int} code
		 * @param {string} name
		 * @param {string} message
		 * @param {object} data
		 */
		var SpiceError = function(code, name, message, data) {
			this.code = code;
			this.name = name;
			this.message = message;
			this.data = data;

			this.stack = (new Error()).stack;
		}

		SpiceError.prototype = new Error();

		return SpiceError;
	}]);
