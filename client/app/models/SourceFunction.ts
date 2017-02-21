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

    getAsStringWithParameters(padding?:string):string {
        let pad = padding ? padding : ' ';
        return this.name + pad + this.getParametersAsString();
    }

    getParametersAsString(): string {
        const parameters = this.parameters
            .map(parameter => `${parameter.sType} ${parameter.name}`)
            .join(", ");

        return `(${parameters})`;
    }
}
