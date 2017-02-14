import {Component, OnInit, Output, EventEmitter} from "@angular/core";
import {FileSystemService} from "../../services/file-system.service";
import {SourceFile} from "../../models/SourceFile";

@Component({
    selector: 'spice-file-browser',
    template: `
<md-list dense class="file-browser">
<spice-file-browser-node [file]="FSS.filesystem" [fileDepth]="0" [selectedFileRef]="selectedFileRef" [onSelected]="GetOnSelected()"></spice-file-browser-node>
</md-list>
`
})
export class FileBrowserComponent implements OnInit {

    public selectedFileRef: {
        file: SourceFile | undefined
    };
    @Output()
    public onFileSelected:EventEmitter<SourceFile>;

    constructor(public FSS:FileSystemService) {
        this.selectedFileRef = {
            file: undefined
        };

        this.onFileSelected = new EventEmitter<SourceFile>();
    }

    ngOnInit() {
        if(this.FSS.filesystem == undefined) {
            this.FSS.getFullFile({
                name: 'c:/',
                path: 'c:/',
                data: {
                    fType: 'directory',
                    contents: null
                },
            }).subscribe((sf:SourceFile)=>{}, (e:any)=> {
                console.error('error getting file'); //TODO professionalize
            });
        }
    }

    public GetOnSelected(): (file:SourceFile) => void {
        let self = this;
        return (file:SourceFile) => {
            self.selectedFileRef.file = file;
            self.onFileSelected.emit(file);
        };
    }


}
