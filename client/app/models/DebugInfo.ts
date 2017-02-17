import { Deserialize } from "../util/SpiceValidator";
import { Process } from "./Process";

export type DebugId = number;

export class DebugInfo {
    @Deserialize()
    id: DebugId;

    @Deserialize()
    attachedProcess: Process;
}
