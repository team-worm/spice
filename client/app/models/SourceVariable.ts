import { Deserialize } from "../util/SpiceValidator";
import { SourceType } from "./SourceType";

export class SourceVariable {
    @Deserialize()
    name: string;

    @Deserialize()
    sType: SourceType;
}
