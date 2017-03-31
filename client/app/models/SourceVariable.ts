import { Deserialize } from "../util/SpiceValidator";
import { SourceType } from "./SourceType";

export type SourceVariableId = number;

export class SourceVariable {
    @Deserialize()
    name: string;

    @Deserialize()
    sType: number;

    @Deserialize()
    address: number;
}
