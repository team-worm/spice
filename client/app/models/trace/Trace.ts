export class Trace {
	constructor(
		public index: number, //Index of the trace, beginning at 0 and totally ordered for each execution.
		public tType: number, //Type of trace: `0`=instruction (state changes), `1`=output (to stdout), `2`=termination (data about how the execution ended)
		public line: number, //Line number that produced this trace.
		public data: any) {
	}
}