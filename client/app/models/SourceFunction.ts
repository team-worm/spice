import { Deserialize } from "../util/SpiceValidator";
import { SourceVariable } from "./SourceVariable";

export type SourceFunctionId = number;

export class SourceFunction {
    @Deserialize()
    address: SourceFunctionId;

    @Deserialize()
    name: string;

    @Deserialize()
    sourcePath: string;

    @Deserialize()
    lineStart: number;

    @Deserialize()
    lineCount: number;

    @Deserialize({ element: SourceVariable })
    parameters: SourceVariable[];

    @Deserialize({ element: SourceVariable })
    locals: SourceVariable[];

}
