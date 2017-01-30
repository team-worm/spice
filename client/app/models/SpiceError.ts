export class SpiceError extends Error {
	constructor(
		public code = 0, //Unique code identifying this error type.
		public name = "SpiceError", //Unique human readable name for this error type.
		public message = "Internal Spice Error", //Human readable error message.
		public data?: any //Data specific to this error.
			){
		super()
	}
}