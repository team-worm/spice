import { Deserialize } from "../util/SpiceValidator";
import { ExecutionId } from "./Execution";
import { SpiceError } from "./SpiceError";
import { Value } from "./Value";

export class Trace {
    @Deserialize()
    index: number;

    @Deserialize()
    line: number;

    @Deserialize()
    data: LineData | ReturnData | BreakData | ExitData | CrashData | CallData | ErrorData;
}

export interface LineData {
    tType: "line";
    state: { [sVariable: number]: Value}
}

export interface ReturnData {
    tType: "return";
    value: Value;
}

export interface BreakData {
    tType: "break";
    nextExecution: ExecutionId;
}

export interface ExitData {
    tType: "exit";
    code: number;
}

export interface CrashData {
    tType: "crash";
    stack: string;
}

export interface CallData {
    tType: "call";
    sFunction: number;
}

export interface ErrorData {
    tType: "error";
    error: SpiceError;
}
