import {Component, OnInit, Output, EventEmitter, Input} from "@angular/core";
import {FileSystemService} from "../../services/file-system.service";
import {SourceFile} from "../../models/SourceFile";

@Component({
    selector: 'spice-file-browser',
    template: `
<div class="file-browser" [style.height.px]="elementHeightPx">
    <div class="small-padding width-100" fxLayout="row">
        <md-icon md-prefix>search</md-icon>
        <md-input-container fxFlex> 
            <input md-input placeholder="Custom Path" (change)="CustomPathChanged($event)"/>
        </md-input-container>
    </div>
    
    <div class="file-list" [style.height.px]="elementHeightPx - 60">
        <md-list dense>
            <spice-file-browser-node 
                [file]="FSS.filesystem" 
                [fileDepth]="0" 
                [selectedFileRef]="selectedFileRef" 
                [customPath]="customPath"
                [onSelected]="GetOnSelected()"></spice-file-browser-node>
        </md-list>
    </div>
</div>
`
})
export class FileBrowserComponent {

    public selectedFileRef: {
        file: SourceFile | undefined
    };

    @Input()
    public elementHeightPx:number;

    @Output()
    public onFileSelected:EventEmitter<SourceFile>;

    public customPath:string;

    constructor(public FSS:FileSystemService) {
        this.selectedFileRef = {
            file: undefined
        };
        this.customPath = '';
        this.elementHeightPx = 0;
        this.onFileSelected = new EventEmitter<SourceFile>();
    }
    public LoadEnteredPath() {

    }
    public CustomPathChanged($event:Event) {
        this.loadFilterPath((<HTMLInputElement> $event.target).value);
    }

    public GetOnSelected(): (file:SourceFile) => void {
        let self = this;
        return (file:SourceFile) => {
            self.selectedFileRef.file = file;
            self.onFileSelected.emit(file);
        };
    }

    private loadFilterPath(path:string) {
        this.customPath = path;

        console.log('LoadFilterPath', path);

        this.FSS.getUpToPath(this.customPath).subscribe((sf:SourceFile)=> {
            console.log('OBSERVABLE', sf);
        }, (err:any) => {
            console.error('ERR', err);
        });
    }


}