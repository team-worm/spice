import {Component, Input, ViewChild, ElementRef, OnInit} from "@angular/core";
import {SourceFile} from "../../models/SourceFile";
import {FileSystemService} from "../../services/file-system.service";
@Component({
    selector: 'spice-file-browser-node',
    template: `
<md-list-item #ListItemElement (click)="Clicked()" class="file-system-node" [ngClass]="{'selected': !!file && selectedFileRef.file == file}">
    <md-icon md-list-avatar class="file-icon" *ngIf="!!file" >{{IconName()}}</md-icon>
    <md-progress-spinner md-list-avatar *ngIf="!file" mode="indeterminate"></md-progress-spinner>
    <p md-line class="file-header">{{FileHead()}}</p>
</md-list-item>
<span *ngIf="IsFolder() && expanded">
    <md-divider></md-divider>
    <span *ngIf="file.contents != undefined">
        <spice-file-browser-node *ngFor="let f of file.contents" 
         [file]="f" [fileDepth]="fileDepth + 1" [selectedFileRef]="selectedFileRef" [onSelected]="onSelected"></spice-file-browser-node></span>
    <span *ngIf="file.contents == undefined"><spice-file-browser-node *ngIf="file.contents == undefined" [fileDepth]="fileDepth + 1"></spice-file-browser-node></span>
    <md-divider></md-divider>
</span>
`
})
export class FileBrowserNodeComponent implements OnInit{
    @Input()
    public file:SourceFile | undefined;
    @Input()
    public fileDepth:number;
    @Input()
    public selectedFileRef: {
        file:SourceFile | undefined
    };
    @Input()
    public onSelected: (file:SourceFile) => void;

    @ViewChild('ListItemElement') DomElement:any;

    public expanded: boolean;

    constructor(private fSS:FileSystemService){
        this.expanded = false;
    }

    ngOnInit():void  {
        this.DomElement._element.nativeElement.style.paddingLeft = this.fileDepth + "em";
    }

    public IsFolder():boolean {
        return !!this.file && this.file.fType == 'dir';
    }
    public IconName():string {
        if(!!this.file) {
            if(this.file.fType == 'dir') {
                if(this.expanded) {
                    return 'folder_open';
                } else {
                    return 'folder';
                }
            } else if(this.file.fType == 'file') {
                return 'insert_drive_file';
            } else {
                return 'error_outline';
            }
        }
        return '';
    }
    public FileHead():string {
        if(!!this.file) {
            return this.file.name;
        } else {
            return 'Loading...'
        }
    }
    public Clicked() {
        if(!!this.file){
            if(this.file.fType == 'dir') {
                if(this.file.contents == undefined) {
                    this.fSS.getFullFile(this.file).subscribe((sf:SourceFile)=>{}, (e:any)=> {
                        console.error('error getting file'); //TODO professionalize
                    });
                }
                this.expanded = !this.expanded;
            } else if(this.file.fType == 'file') {
                this.onSelected(this.file);
            }
        }
    }
}