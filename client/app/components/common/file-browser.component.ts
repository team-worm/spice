import { Component, Output, EventEmitter, Input, ElementRef } from "@angular/core";
import { FileSystemService } from "../../services/file-system.service";
import { SourceFile } from "../../models/SourceFile";

@Component({
    selector: 'spice-file-browser',
    template: `
<div class="file-browser-component" [style.height.px]="elementHeightPx">
    <div class="small-padding width-100" fxLayout="row">
        <md-input-container fxFlex> 
            <input mdInput placeholder="Path Lookup" (change)="CustomPathChanged($event)"/>
        </md-input-container>
        <md-icon class="input-icon">find_in_page</md-icon>
        <md-input-container fxFlex="25"> 
            <input mdInput placeholder="Filter Files" (keyup)="FilterNameKeyDown($event)"/>
        </md-input-container>
    </div>
    
    <div class="file-list" [style.height.px]="elementHeightPx - 60">
        <md-list dense>
            <spice-file-browser-node 
                [file]="FSS.filesystem" 
                [fileDepth]="-1" 
                [selectedFileRef]="selectedFileRef" 
                [customPath]="customPath"
                [onSelected]="GetOnSelected()"
[onDoubleClickFile]="GetOnDoubleClickFile()"
                [filterNameChangeEmitter]="filterNameChangeEmitter"></spice-file-browser-node>
        </md-list>
    </div>
</div>
`
})
export class FileBrowserComponent {

    public selectedFileRef: {
        file: SourceFile | null
    };

    @Input()
    public elementHeightPx: number;

    @Output()
    public onFileSelected: EventEmitter<SourceFile>;

    @Output()
    public onDoubleClickFile: EventEmitter<SourceFile>;

    public filterNameChangeEmitter: EventEmitter<string>;

    public customPath: string;

    public filterName: string; //TODO: Finish implementing this;

    constructor(public FSS: FileSystemService,
        public element: ElementRef) {
        this.selectedFileRef = {
            file: null
        };
        this.customPath = '';
        this.elementHeightPx = 0;
        this.onFileSelected = new EventEmitter<SourceFile>();
        this.onDoubleClickFile = new EventEmitter<SourceFile>();
        this.filterNameChangeEmitter = new EventEmitter<string>();
    }
    public CustomPathChanged($event: Event) {
        this.loadFilterPath((<HTMLInputElement>$event.target).value);
    }

    public GetOnSelected(): (file: SourceFile) => void {
        let self = this;
        return (file: SourceFile) => {
            self.selectedFileRef.file = file;
            self.onFileSelected.emit(file);
        };
    }

    public GetOnDoubleClickFile(): (file: SourceFile) => void {
        let self = this;
        return (file: SourceFile) => {
            self.selectedFileRef.file = file;
            self.onDoubleClickFile.emit(file);
        };
    }

    public ResetSelectedFile() {
        this.selectedFileRef.file = null;
    }

    public FilterNameKeyDown($event: KeyboardEvent) {
        this.filterNameChangeEmitter.emit((<HTMLInputElement>$event.srcElement).value.toLowerCase());
    }

    private loadFilterPath(path: string) {
        this.customPath = path;

        this.FSS.getUpToPath(this.customPath).subscribe((sf: SourceFile) => { }, (err: any) => {
            /* TODO: Determine if this is an error or not */
            //console.error('Error loading Custom Path.', err);
        });
    }


}
