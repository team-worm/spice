import { SourceFunctionId } from "./SourceFunction";

export type ExecutionId = number;

export interface Execution {
    id: ExecutionId;
    data: ProcessData | FunctionData;
}

interface ProcessData {
    eType: "process";
}

interface FunctionData {
    eType: "function";
    sFunction: SourceFunctionId;
}
