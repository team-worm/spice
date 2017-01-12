import {DebugId} from "./DebugId";
import {Process} from "./Process";

export class DebugInfo {
    public id:DebugId;
    public attachedProcess:Process;
    public sourcePath:string; //Path to root directory of source code.
}