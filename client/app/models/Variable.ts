/**
 * Created by Samuel on 1/11/2017.
 */

import {SourceType} from "./SourceType";


export class Variable {
    public id: string; //Unique identifier of that variable.
    public name: string; //Name of the variable as it appears in the function.
    public sType: SourceType; //Type of the variable as it is defined in the source code.
    public address: number; //Memory address.

    constructor() {

    }
}