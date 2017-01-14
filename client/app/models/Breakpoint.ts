import {SourceFunction} from "./SourceFunction";

export class Breakpoint {
    public sFunction: SourceFunction; //The function that this is breakpoint is associated with.
    public metadata: string; //Any additional info associated with this breakpoint.
}