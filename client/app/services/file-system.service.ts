import {Injectable} from "@angular/core";
import {SourceFile} from "../models/SourceFile";
import {Observable} from "rxjs/Observable";

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
                    name: 'Spice Directory',
                    path: '',
                    fType: 'directory',
                    contents: [
                        {
                            name: 'testBin',
                            path: 'testBin/',
                            fType: 'directory',
                            contents: undefined
                        },
                        {
                            name: 'collatz.exe',
                            path: 'collatz.exe',
                            fType: 'file',
                            contents: undefined
                        },
                    ]
                };
                break;
            case 'testBin/':
                ret = {
                    name: 'testBin',
                    path: 'testBin/',
                    fType: 'directory',
                    contents: [{
                        name: 'SpiceTestApp.exe',
                        path: 'testBin/SpiceTestApp.exe',
                        fType: 'file',
                        contents: undefined
                    },
                    {
                        name: 'SpiceTestApp.ilk',
                        path: 'testBin/SpiceTestApp.ilk',
                        fType: 'file',
                        contents: undefined
                    },
                    {
                        name: 'SpiceTestApp.pdb',
                        path: 'testBin/SpiceTestApp.pdb',
                        fType: 'file',
                        contents: undefined
                    }]};
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

    public getFileContents(path: string): Observable<string> {
        if(path.indexOf('collatz.cpp') !== -1) {
            return Observable.of(`// collatz.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include <stdio.h>

int collatz(int n) {
	int t = 0;
	while (n != 1) {
		if (n % 2 == 0) {
			n /= 2;
		}
		else {
			n = 3*n + 1;
		}
		t++;
	}
	return t;
}

int main()
{
	printf("%d\n", collatz(3));
    return 0;
}

`);
        }
        return Observable.throw(new Error('mocked file not found.'))

    }
}
