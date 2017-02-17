import { Deserialize } from "../util/SpiceValidator";

export class Process {
    @Deserialize()
    id: number;

    @Deserialize()
    name: string;
}
