import {Execution} from "./Execution";

export class ExecutionOfProcess implements Execution {
    id: number; //Unique identifier.
    eType: string = 'process'; //Type of execution. Either `function` or `process`.
    status: string; //Either `pending`, `executing`, `stopped`, or `done`.
    executionTime: number; //Execution time in nanoseconds.
    data: {
        /*Id of the execution that follows this one. Null until `status=done`.
         * Initially set to `null`, set when a call to `/debug/execute` hits a breakpoint,
         * in which case it points to the breakpoint function’s execution.*/
        nextExecution: string;
    }
}