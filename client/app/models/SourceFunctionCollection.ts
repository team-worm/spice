import {Deserialize} from "../util/SpiceValidator";
import {SourceFunction} from "./SourceFunction";
export class SourceFunctionCollection {

    @Deserialize()
    collectionName: string;

    @Deserialize({ element: String })
    functionNames: string[];
}