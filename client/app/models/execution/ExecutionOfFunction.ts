import {Execution} from "./Execution";
import {SourceFunction} from "../SourceFunction";

export class ExecutionOfFunction implements Execution {
    id:number; //Unique identifier.
    eType:string = 'function'; //Type of execution. Either `function` or `process`.
    status:string; //Either `pending`, `executing`, `stopped`, or `done`.
    executionTime:number; //Execution time in nanoseconds.
    data:{
        sFunction:SourceFunction; //Function that produced this execution.
    }
}