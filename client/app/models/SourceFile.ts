import {SpiceValidator} from "../util/SpiceValidator";
export class SourceFile {
    name: string; //Name of file.
    path: string; //Path to file.
    fType: string; //File type ("file" or "directory")
    /*Only defined if fType='directory'.
     * An array of Files inside the directory.
     * Subdirectories have "contents" field set to undefined so the entire directory subtree is not returned. */
    contents: SourceFile[] | undefined;

    constructor(_name:string, _path:string, _fType:string, _contents:SourceFile[] | undefined) {
        this.name = _name;
        this.path = _path;
        this.fType = _fType;
        this.contents = _contents
    }

    public static fromObjectStrict(obj: any): SourceFile {
        SpiceValidator.assertTypeofStrict(obj, 'object');
        SpiceValidator.assertTypeofStrict(obj.name, 'string');
        SpiceValidator.assertTypeofStrict(obj.path, 'string');
        SpiceValidator.assertTypeofStrict(obj.fType, 'string');
        SpiceValidator.assertArrayStrict(obj.contents);

        return new SourceFile(obj.name, obj.path, obj.fType, obj.contents);
    }

}