import {Injectable} from "@angular/core";
import {SourceFile} from "../models/SourceFile";
import {Observable} from "rxjs/Observable";
import {Http} from "@angular/http";
import {Subscriber} from "rxjs";
import {InvalidServerDataError, InvalidTypeError} from "../models/Errors";


const host:string = 'localhost';
const port:number = 3000;

@Injectable()
export class FileSystemService {

    private _filesystem:SourceFile;

    constructor(private http: Http) {
        this._filesystem = { // TODO: check if on windows or linux or whatever.
            name: 'c:/',
            path: 'c:/',
            data: {
                fType: "directory",
                contents: null
            }
        };
    }

    get filesystem(): SourceFile | null {
        return this._filesystem;
    }

    public getUpToPath(path:string): Observable<SourceFile> {
        return Observable.create((subscriber:Subscriber<SourceFile>)=> {
            if(path.indexOf(this._filesystem.path) != 0) {
                subscriber.error('bad path name');
                return;
            }
            let parts:string[] = path.split('/');
            let partsToLoad:string[] = [];
            let sf: SourceFile | undefined = this._filesystem;

            for(let i = 1; i < parts.length; i++) {

                if(sf == undefined) {
                    subscriber.complete();
                    return;
                } else {
                    subscriber.next(sf);
                }

                if(sf.data.fType === 'file') {
                    subscriber.error('file-system error, root is a file not directory');
                    return;
                }

                if(sf.data.contents == null) {
                    partsToLoad = parts.splice(i);
                    break;
                }
                sf = sf.data.contents.find((child:SourceFile) => {return child.name === parts[i];});
            }

            if(!!sf && partsToLoad.length > 0) {
                this.getFileChain(subscriber, sf, partsToLoad);
            }
        });
    }

    private getFileChain(subscriber:Subscriber<SourceFile>, file:SourceFile, chain:string[]) {

        if(file.data.fType === 'file') {
            subscriber.next(file);
            subscriber.complete();
            return;
        }

        let path = file.path.charAt(file.path.length-1) === '/' ? file.path : file.path + '/';

        this.http.get(`http://${host}:${port}/api/v1/filesystem/${path}`)
            .subscribe((res: any) => {

                let retSf = res.json() as SourceFile;
                file.data = retSf.data;

                subscriber.next(file);

                if(retSf.data.fType === 'file') {
                    subscriber.complete();
                } else if(!!retSf.data.contents) { //TODO: fix the API russell
                    let nextFile: SourceFile | undefined;
                    if(chain.length > 0 && !!(nextFile = retSf.data.contents.find((child:SourceFile) => {return child.name === chain[0];}))) {
                        this.getFileChain(subscriber, nextFile, chain.splice(1));
                    } else {
                        subscriber.complete();
                    }
                }

                return retSf;
            },(err:any) => {
                subscriber.error(err);
                subscriber.complete();
            });
    }

    public getFullFile(file:SourceFile) : Observable<SourceFile> {
        let path = file.path;
        if(path[path.length-1] !== '/') {
            path += '/';
        }
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
