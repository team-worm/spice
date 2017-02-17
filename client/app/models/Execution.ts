import { Deserialize } from "../util/SpiceValidator";
import { SourceFunctionId } from "./SourceFunction";

export type ExecutionId = number;

export class Execution {
    @Deserialize()
    id: ExecutionId;

    @Deserialize()
    data: ProcessData | FunctionData;
}

interface ProcessData {
    eType: "process";
}

interface FunctionData {
    eType: "function";
    sFunction: SourceFunctionId;
}
