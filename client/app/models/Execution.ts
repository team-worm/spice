import { Deserialize } from "../util/SpiceValidator";
import { SourceFunctionId } from "./SourceFunction";

export type ExecutionId = number;

export class Execution {
    @Deserialize()
    id: ExecutionId;

    @Deserialize()
    data: ProcessData | FunctionData;
}

export interface ProcessData {
    eType: "process";
}

export interface FunctionData {
    eType: "function";
    sFunction: SourceFunctionId;
}
