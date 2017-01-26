import {Component, Input, EventEmitter, Output} from "@angular/core";
import {Process} from "../../models/Process";

@Component({
    selector: 'spice-process-list',
    template: `
<div>
<md-icon>search</md-icon>
<md-input-container> <input md-input [(ngModel)]="filterString"/></md-input-container>
<button md-raised-button [mdMenuTriggerFor]="sortMenu"><md-icon>sort</md-icon>: {{selectedSort.name}}<md-icon>{{selectedSort.icon}}</md-icon></button>
<md-menu #sortMenu="mdMenu">
    <button *ngFor="let sortOption of sortingOptions" md-menu-item (click)="selectedSort=sortOption">{{sortOption.name}}<md-icon>{{sortOption.icon}}</md-icon></button>
</md-menu>
<md-list dense class="process-list">
    <md-list-item *ngFor="let process of selectedSort.sortFunc(processes) | filterByString:filterString:ProcessToString" class="process-list-item" (click)="ProcessClicked(process)">
        <md-icon md-list-avatar class="process-icon">settings_application</md-icon>
        <p md-line class="process-header">{{process.name}}</p>
        <p md-line class="process-subheader">ID: {{process.id}}</p>
    </md-list-item>
</md-list>
</div>
`
})
export class ProcessListComponent{

    public filterString:string;

    public selectedSort:{
        name:string,
        icon: string,
        sortFunc:(p:Process[])=>Process[],
    };
    public sortingOptions:{
        name:string,
        icon: string,
        sortFunc:(p:Process[])=>Process[],
    }[];

    public processes: Process[];

    @Output()
    public onProcessSelected: EventEmitter<Process>;

    constructor() {
        let self = this;
        this.onProcessSelected = new EventEmitter<Process>();
        this.sortingOptions = [{
            name: 'Name',
            icon: 'arrow_drop_up',
            sortFunc: (processes:Process[])=>{return self.sortNameAscending(processes)}
        },{
            name: 'Name',
            icon: 'arrow_drop_down',
            sortFunc: (processes:Process[])=>{return self.sortNameAscending(processes).reverse()}
        },{
            name: 'ID',
            icon: 'arrow_drop_up',
            sortFunc: (processes:Process[])=>{return self.sortIDAscending(processes)}
        }, {
            name: 'ID',
            icon: 'arrow_drop_down',
            sortFunc: (processes:Process[])=>{return self.sortIDAscending(processes).reverse()}
        }
        ];
        this.selectedSort = this.sortingOptions[0];
        this.processes = [
            {
                name: "Chrome",
                id: 12345
            },
            {
                name: "Steam",
                id: 3001
            },
            {
                name: "Explorer",
                id: 4
            },
            {
                name: "VLC Media Player",
                id: 1035
            },
            {
                name: "Binary-Search",
                id: 44032
            },
            {
                name: "Excel",
                id: 3392
            },
            {
                name: "Visual Studio",
                id: 3290
            },
            {
                name: "Task Manager",
                id: 5
            }];
    }

    public ProcessClicked(process:Process) {
        this.onProcessSelected.emit(process);
    }
    public ProcessToString(process:Process) {
        return process.name;
    }

    private sortNameAscending(processes:Process[]): Process[] {
        processes.sort((a:Process, b:Process)=> {
            if(a.name < b.name) {
                return -1;
            } else if(a.name > b.name) {
                return 1;
            }
            return 0;
        });
        return processes;
    }
    private sortIDAscending(processes:Process[]): Process[] {
        processes.sort((a:Process, b:Process)=> {
            if(a.id < b.id) {
                return -1;
            } else if(a.id > b.id) {
                return 1;
            }
            return 0;
        });
        return processes;
    }

}