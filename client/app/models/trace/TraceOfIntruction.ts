import {Trace} from "./Trace";
import {SourceVariable} from "../SourceVariable";
import { InvalidValueError } from "../errors/Errors";
import { SpiceValidator } from "../../util/SpiceValidator";

export type InstructionState = {sVariable: string, value: any};
export class TraceOfIntruction extends Trace {
	constructor(index: number, line: number, data: { state: InstructionState[] }) {
			super(index, 0, line, data);
		}

	/** validate data, assume all other fields are already valid */
	public static fromObjectStrictData(obj: any): TraceOfIntruction {
		SpiceValidator.assertTypeofStrict(obj.data, 'object');
		//TODO: restore this when the protocol is fixed
		// SpiceValidator.assertArrayStrict(obj.data.state);

		//TODO: change this when the typing protocol is updated
		let state = {
			state: obj.data.map((s: any) => { return { sVariable: s.variable, value: s.value}})
		};

		// let state = obj.data.state.map(function(is: any) {
		// 	SpiceValidator.assertTypeofStrict(is, 'object');
		// 	SpiceValidator.assertTypeofStrict(is.sVariable, 'object');
		// 	let sVariable = is.sVariable;
		// 	if(!(sVariable instanceof SourceVariable)) {
		// 		sVariable = SourceVariable.fromObjectStrict(sVariable);
		// 	}
		// 	return { sVariable: sVariable, value: is.value};
		// });

		return new TraceOfIntruction(obj.index, obj.line, state);
	}
}
