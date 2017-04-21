import { Component, Input, ViewChild, OnInit, EventEmitter } from "@angular/core";
import { SourceFile } from "../../models/SourceFile";
import { FileSystemService } from "../../services/file-system.service";

/**
 * File Browser Node Component
 * These nodes are created by either parent File Browser Node Components or the File Browser Component.
 * They perform 3 functions:
 *  a) Draw the name and type of file that this node represents
 *  b) Request and create the child File Browser Node Components in the case of this node being a folder.
 *  c) Reports back to the File Browser Component when a node has been selected.
 */

@Component({
    selector: 'spice-file-browser-node',
    template: `
<md-list-item #ListItemElement 
    class="file-system-node" 
    *ngIf="!filtered && !IsRootContainer()"
    (click)="Clicked()" (dblclick)="DoubleClicked()" 
    [ngClass]="{'selected': !!file && selectedFileRef.file === file, 'searched': inCustomPath()}"
    [style.paddingLeft]="(this.fileDepth*1.5) + 'em'">
    <md-icon md-list-avatar class="file-icon">{{IconName()}}</md-icon>
    <md-progress-spinner md-list-avatar *ngIf="file === undefined" mode="indeterminate"></md-progress-spinner>
    <p md-line class="file-header">{{FileHead()}}</p>
</md-list-item>
<span *ngIf="IsRootContainer() && file === null"><md-icon>{{IconName()}}</md-icon> {{FileHead()}}</span>

<span *ngIf="IsFolder()" [style.display]="IsExpanded() ? 'inherit' : 'none'" >
    <md-divider class="divider-spacing"></md-divider>
    <span *ngIf="FileHasContents()">
        <spice-file-browser-node *ngFor="let f of file.data.contents" 
         [file]="f" 
         [fileDepth]="fileDepth + 1" 
         [selectedFileRef]="selectedFileRef" 
         [onSelected]="onSelected" 
         [onDoubleClickFile]="onDoubleClickFile"
         [customPath]="customPath"
         [filterNameChangeEmitter]="filterNameChangeEmitter"></spice-file-browser-node>
    </span>
    <spice-file-browser-node *ngIf="!FileHasContents()" [fileDepth]="fileDepth + 1"></spice-file-browser-node>
</span>
`
})
export class FileBrowserNodeComponent implements OnInit {
    @Input()
    public file: SourceFile | null | undefined;
    @Input()
    public fileDepth: number;
    @Input()
    public selectedFileRef: {
        file: SourceFile | null
    };
    @Input()
    public onSelected: (file: SourceFile) => void;
    @Input()
    public onDoubleClickFile: (file: SourceFile) => void;
    @Input()
    public customPath: string;
    @Input()
    public filterNameChangeEmitter: EventEmitter<string>;

    public expanded: boolean;

    public filtered: boolean; //True means hide.

    @ViewChild('ListItemElement') DomElement: any;

    constructor(private fSS: FileSystemService) {
        this.expanded = false;
        this.filtered = false;
    }

    ngOnInit(): void {
        if (this.inCustomPath()) {
            if (this.file && this.file.data.fType === 'file') {
                setTimeout(() => {
                    if (this.file) {
                        this.onSelected(this.file);
                    }

                }, 50);

            }
        }

        if (this.filterNameChangeEmitter) {
            this.filterNameChangeEmitter.subscribe((filter: string) => {
                if (this.file) {
                    this.filtered = this.file.name.toLowerCase().indexOf(filter) === -1;
                }
            });
        }
    }

    public IsFolder(): boolean {
        return !!this.file && this.file.data.fType === 'directory';
    }
    public FileHasContents(): boolean {
        return !!this.file && this.file.data.fType === 'directory' && this.file.data.contents !== null;
    }
    public IsExpanded(): boolean {
        if (this.inCustomPath()) {
            this.expanded = true;
        }
        return this.expanded
    }
    public IconName(): string {
        if (!!this.file) {
            if (this.file.data.fType === 'directory') {
                if (this.IsExpanded()) {
                    return 'folder_open';
                } else {
                    return 'folder';
                }
            } else if (this.file.data.fType === 'file') {
                return 'insert_drive_file';
            } else {
                return 'error_outline';
            }
        }
        if (this.file === null) {
            return 'error'
        }
        return '';
    }
    public FileHead(): string {
        if (!!this.file) {
            return this.file.name;
        } else if(this.file === undefined) {
            return 'Loading...'
        } else {
            return 'error loading file'
        }
    }
    public Clicked() {
        if (!!this.file) {
            if (this.file.data.fType === 'directory' && !this.inCustomPath()) {
                if (this.file.data.contents === null) {
                    this.fSS.getFullFile(this.file).subscribe((sf: SourceFile) => {
                    }, (e: any) => {
                        console.error('Error error getting file contents', e); //TODO professionalize
                    });
                }
                this.expanded = !this.expanded;
            } else if (this.file.data.fType === 'file') {
                this.onSelected(this.file);
            }
        }
    }
    public DoubleClicked() {
        if (!!this.file) {
            if (this.file.data.fType === 'file') {
                this.onSelected(this.file);
                this.onDoubleClickFile(this.file);
            }
        }
    }

    public IsRootContainer(): boolean {
        return this.file === this.fSS.filesystem;
    }

    private inCustomPath(): boolean {
        return !!this.file && this.customPath.indexOf(this.file.path) >= 0;
    }
}
