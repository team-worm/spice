import {Process} from "./Process";

export type DebugId = number;

export interface DebugInfo {
    id: DebugId;
    attachedProcess: Process;
}
