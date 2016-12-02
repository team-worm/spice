angular.module('Spice')
	.factory('Stream', ['$q', function($q){

		var StreamClosedError = function(message) {
			this.stack = (new Error()).stack;
		}

		StreamClosedError.prototype = new Error();
		StreamClosedError.prototype.name = 'StreamClosedError';

		/**
		 * Represents data that may be streamed.
		 * every write appends to the "data" array
		 * @constructor
		 */
		var Stream = function() {
			this.data = [];
			this.closed = false;
			this.closeError = undefined;

			this.listeners = []; // map[int]function: new listener created for each "read" call
			this.currentListenerId = 0; // incremented for each read call
		}

		Stream.prototype.write = function(newData) {
			if(this.closed) {
				throw new StreamClosedError('Stream.write: Cannot write to closed stream');
			}

			this.data.push(newData);
			this._sendEvent({
				type: 'write',
				index: this.data.length - 1
			});
		};

		Stream.prototype.close = function(err) {
			if(this.closed) {
				throw new StreamClosedError('Stream.close: Cannot close an already closed stream');
			}

			this.closed = true;
			this.closeError = err;
			this._sendEvent({
				type: 'close',
				error: err
			});
		};

		Stream.prototype._sendEvent = function(event) {
			var _this = this;
			Object.keys(_this.listeners).forEach(function(key) {
				_this.listeners[key](event);
			});
		}

		/**
		 * @returns {object}
		 */
		Stream.prototype.read = function(onData) {
			var _this = this;
			var listenerId = this.currentListenerId;
			this.currentListenerId++;
			return {
				id: listenerId,
				done: $q(function(resolve, reject) {
					// call onData for all existing writes
					for(var i = 0; i < _this.data.length; i++) {
						onData(_this.data[i]);
					}

					if(_this.closed) {
						if(_this.closeError) {
							reject(_this.closeError);
						}
						else {
							resolve();
						}
						return;
					}

					// listen for new events
					_this.listeners[listenerId] = function(event) {
						switch(event.type) {
							case 'write':
								onData(_this.data[event.index]);
								break;
							case 'close':
								_this.cancelRead(listenerId);
								if(event.error) {
									reject(event.error);
								}
								else {
									resolve();
								}
								break;
						}
					}
				})
			};
		};

		Stream.prototype.cancelRead = function(readId) {
			delete this.listeners[readId];
		}

		Stream.StreamClosedError = StreamClosedError;
		return Stream;
	}]);
