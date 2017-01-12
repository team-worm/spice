export interface Execution {
    id:number; //Unique identifier.
    eType:string; //Type of execution. Either `function` or `process`.
    status:string; //Either `pending`, `executing`, `stopped`, or `done`.
    executionTime:number; //Execution time in nanoseconds.
    data:any;
}