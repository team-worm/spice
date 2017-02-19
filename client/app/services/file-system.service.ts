import {Injectable} from "@angular/core";
import {SourceFile} from "../models/SourceFile";
import {Observable} from "rxjs/Observable";
import {Http} from "@angular/http";
import {InvalidServerDataError, InvalidTypeError} from "../models/Errors";

const host:string = 'localhost';
const port:number = 3000;

@Injectable()
export class FileSystemService {
    private _filesystem:SourceFile | null;

    constructor(private http: Http) {
        this._filesystem = null;
    }

    get filesystem(): SourceFile | null {
        return this._filesystem;
    }

    public getFullFile(file:SourceFile) : Observable<SourceFile> {
        if(!this._filesystem) {
           this._filesystem = file;
        }
        let path = file.path;
        return this.http.get(`http://${host}:${port}/api/v1/filesystem/${path}`)
            .map((res: any) => {
                let retSf = res.json() as SourceFile;
                file.data = retSf.data;
                return retSf;
            })
            .catch(FileSystemService.handleServerDataError('SourceFile')).share();
    }

    public getFileContents(path: string): Observable<string> {
        return this.http.get(`http://${host}:${port}/file/${path}`)
            .map((res: any) => {
                return res.text();
            })
            .catch(FileSystemService.handleServerDataError('File Contents')).share();
    }

    private static handleServerDataError(typeName: string) {
        return (err: any) => {
            if(err instanceof InvalidTypeError) {
                return Observable.throw(new InvalidServerDataError(typeName, err));
            }

            return Observable.throw(err);
        }
    }
}
