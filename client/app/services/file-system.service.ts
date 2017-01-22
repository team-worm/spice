import {Injectable} from "@angular/core";
import {SourceFile} from "../models/SourceFile";

@Injectable()
export class FileSystemService {
    //TODO: Fully implement, currently filled with Mock Data.

    public GetFile(path: string) : SourceFile | undefined {
        switch(path) {
            case '':
                return {
                    name: 'root',
                    path: '/',
                    fType: 'directory',
                    contents: [
                        {
                            name: 'src',
                            path: '/src/',
                            fType: 'directory',
                            contents: undefined
                        },
                        {
                            name: 'bin',
                            path: '/bin/',
                            fType: 'directory',
                            contents: undefined
                        },
                        {
                            name: 'readme.txt',
                            path: '/readme.txt',
                            fType: 'file',
                            contents: undefined
                        }
                    ]
                };
            case '/src/':
                return {
                    name: 'src',
                    path: '/src/',
                    fType: 'directory',
                    contents: [{
                        name: 'binary-search.c',
                        path: '/src/binary-search.c',
                        fType: 'file',
                        contents: undefined
                    },
                    {
                        name: 'main.c',
                        path: '/src/main.c',
                        fType: 'file',
                        contents: undefined
                    }]
                };
            case '/bin/':
                return {
                    name: 'bin',
                    path: '/bin/',
                    fType: 'directory',
                    contents: [{
                        name: 'binary-search.exe',
                        path: '/bin/binary-search.exe',
                        fType: 'file',
                        contents: undefined
                    }]
                };
            default:
                return undefined;
        }
    }
}