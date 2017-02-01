import {Injectable} from "@angular/core";
import {SourceFile} from "../models/SourceFile";

@Injectable()
export class FileSystemService {
    //TODO: Fully implement, currently filled with Mock Data.

    private _filesystem:SourceFile | undefined;

    constructor() {
        this._filesystem = undefined;
    }

    get filesystem(): SourceFile | undefined {
        return this._filesystem;
    }

    public GetFile(file?: SourceFile) : SourceFile | undefined {
        let _path:string = '';
        if(file) {
            _path = file.path;
        }
        let ret: SourceFile | undefined;
        /* Load up a bunch of mock data. */
        switch(_path) {
            case '':
                ret = {
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
                            name: 'unloadable',
                            path: '/unloadable/',
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
                break;
            case '/src/':
                ret = {
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
                break;
            case '/bin/':
                ret =  {
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
                break;
            default:
                ret = undefined;
        }

        if(file) {
            if(ret)
                file.contents = ret.contents;
            else
                file.contents = undefined;
        } else if(ret) {
            this._filesystem = ret;
        }

        return ret;
    }
}