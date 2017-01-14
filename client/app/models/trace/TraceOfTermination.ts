import {Trace} from "./Trace";

export class TraceOfTermination implements Trace {
    public index: number; //Index of the trace, beginning at 0 and totally ordered for each execution.
    public tType: number = 2; //Type of trace: `0`=instruction (state changes), `1`=output (to stdout), `2`=termination (data about how the execution ended)
    public line: number; //Line number that produced this trace.
    public data: {
        cause: string; //Reason for termination. Either `stopped`, `crashed`, `ended`, or `breakpoint`.
        stack: string; //(defined if cause=crashed): Stack trace output.
        returnValue: number; //(defined if cause=ended): Function return value or program exit code.
        nextExecution: string; //(defined if cause=breakpoint): Id of the following function execution
    };
}