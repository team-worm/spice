export class SourceFile {
    name:string; //Name of file.
    path:string; //Path to file.
    fType:string; //File type ("file" or "directory")
    /*Only defined if fType='directory'.
    * An array of Files inside the directory.
    * Subdirectories have "contents" field set to undefined so the entire directory subtree is not returned. */
    contents:SourceFile[];
}