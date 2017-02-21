import {Component, Output, EventEmitter, Input, ElementRef} from "@angular/core";
import {FileSystemService} from "../../services/file-system.service";
import {SourceFile} from "../../models/SourceFile";

@Component({
    selector: 'spice-file-browser',
    template: `
<div class="file-browser-component" [style.height.px]="elementHeightPx">
    <div class="small-padding width-100" fxLayout="row">
        <md-icon class="input-icon">find_in_page</md-icon>
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
        file: SourceFile | null
    };

    @Input()
    public elementHeightPx:number;

    @Output()
    public onFileSelected:EventEmitter<SourceFile>;

    public customPath:string;

    constructor(public FSS:FileSystemService,
                public element: ElementRef) {
        this.selectedFileRef = {
            file: null
        };
        this.customPath = '';
        this.elementHeightPx = 0;
        this.onFileSelected = new EventEmitter<SourceFile>();
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

        this.FSS.getUpToPath(this.customPath).subscribe((sf:SourceFile)=> {}, (err:any) => {
            console.error('Error loading Custom Path.', err);
        });
    }


}