import { Deserialize } from "../util/SpiceValidator";

export class Breakpoint {
    @Deserialize()
    sFunction: number;
}
