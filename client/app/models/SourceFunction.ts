import {Variable} from "./Variable";

export class SourceFunction {
    public address: number; //Memory address of the function.
    public name: string; //Name of the function.
    public sourcePath: string; //Full path to the source code.
    public lineNumber: number; //Line number of the function definition.
    public lineCount: number; //Length of function in source code lines.
    public parameters: Variable[]; //Array of parameter variables.
    public localVariables: Variable[]; //Array of all local variables defined in function.
}