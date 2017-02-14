import { ExecutionId } from "./Execution";
import { SpiceError } from "./SpiceError";

export interface Trace {
    index: number;
    line: number;
    data: LineData | ReturnData | BreakData | ExitData | CrashData | ErrorData;
}

interface LineData {
    tType: "line";
    state: TraceState[];
}

interface ReturnData {
    tType: "return";
    value: string;
}

interface BreakData {
    tType: "break";
    nextExecution: ExecutionId;
}

interface ExitData {
    tType: "exit";
    code: number;
}

interface CrashData {
    tType: "crash";
    stack: string;
}

interface ErrorData {
    tType: "error";
    error: SpiceError;
}

export interface TraceState {
    sVariable: string;
    value: string;
}
