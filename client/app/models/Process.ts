import { SpiceValidator } from "../util/SpiceValidator";
export class Process {
	constructor(
		public id: string, //Identifying number of process on host machine.
		public name: string //Name of process on host machine.
	){
	}

	public static fromObjectStrict(obj: any): Process {
		SpiceValidator.assertTypeofStrict(obj, 'object');
		SpiceValidator.assertTypeofStrict(obj.id, 'number');
		SpiceValidator.assertTypeofStrict(obj.name, 'string');
		obj.id = obj.id.toString();

		return new Process(obj.id, obj.name);
	}
}
