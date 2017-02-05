import { SpiceValidator } from "../util/SpiceValidator";
import {SourceVariable} from "./SourceVariable";
import {SourceFunctionId} from "./SourceFunctionId";
import { InvalidServerDataError } from "./errors/Errors";

export class SourceFunction {
	public get id():SourceFunctionId {
		return ""+this.address
	}
	constructor(
		public address: number, //Memory address of the function.
		public name: string, //Name of the function.
		public sourcePath: string, //Full path to the source code.
		public lineNumber: number, //Line number of the function definition.
		public lineCount: number, //Length of function in source code lines.
		public parameters: SourceVariable[], //Array of parameter variables.
		public localVariables: SourceVariable[] //Array of all local variables defined in function.
	) {
	}

	public GetParametersAsString():string {
		let out:string = '(';
		let first:boolean = true;

		for(let i = 0; i < this.parameters.length; i++) {
			let par = this.parameters[i];
			if(first) {
				first = false;
			} else {
				out += ', '
			}
			out += par.sType.toString() + ' ';
			out += par.name;
		}
		if(first) {
			out += ' ';
		}
		out += ')';

		return out;
	}

	static fromObjectStrict(obj: any): SourceFunction {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.address, 'number');
		SpiceValidator.assertTypeofStrict(obj.name, 'string');
		SpiceValidator.assertTypeofStrict(obj.sourcePath, 'string');
		SpiceValidator.assertTypeofStrict(obj.lineNumber, 'number');
		SpiceValidator.assertTypeofStrict(obj.lineCount, 'number');
		SpiceValidator.assertArrayStrict(obj.parameters);
		SpiceValidator.assertArrayStrict(obj.localVariables);

		let parameters: SourceVariable[] = (<any[]>obj.parameters).map(p => SourceVariable.fromObjectStrict(p));
		let localVariables: SourceVariable[] = (<any[]>obj.localVariables).map(v => SourceVariable.fromObjectStrict(v));

		return new SourceFunction(obj.address, obj.name, obj.sourcePath, obj.lineNumber, obj.lineCount, parameters, localVariables);
	}

}
