export interface SourceFile {
    name: string;
    path: string;
    data: FileData | DirectoryData;
}

interface FileData {
    fType: "file";
}

interface DirectoryData {
    fType: "directory";
    contents: SourceFile[] | null;
}
