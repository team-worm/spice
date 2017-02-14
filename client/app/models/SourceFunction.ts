import { SourceVariable } from "./SourceVariable";

export type SourceFunctionId = number;

export interface SourceFunction {
    address: SourceFunctionId;
    name: string;
    sourcePath: string;
    lineStart: number;
    lineCount: number;
    parameters: SourceVariable[];
    locals: SourceVariable[];
}

export function getParametersAsString(sFunction: SourceFunction): string {
    const parameters = sFunction.parameters
        .map(parameter => `${parameter.sType} ${parameter.name}`)
        .join(", ");

    return `(${parameters})`;
}
