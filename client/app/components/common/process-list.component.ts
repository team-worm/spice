import {Component, Input, EventEmitter, Output, OnInit} from "@angular/core";
import {Process} from "../../models/Process";
import { DebuggerService } from "../../services/debugger.service";

@Component({
    selector: 'spice-process-list',
    template: `
<div>
    <div class="small-padding width-100" fxLayout="row">
        <md-icon>search</md-icon>
        <md-input-container fxFlex>
            <input md-input [(ngModel)]="filterString"/>
        </md-input-container>
        <span>
            <button md-raised-button [mdMenuTriggerFor]="sortMenu"><md-icon>sort</md-icon>: {{selectedSort.name}}<md-icon>{{selectedSort.icon}}</md-icon></button>
            <md-menu #sortMenu="mdMenu">
                <button *ngFor="let sortOption of sortingOptions" md-menu-item (click)="selectedSort=sortOption">{{sortOption.name}}<md-icon>{{sortOption.icon}}</md-icon></button>
            </md-menu>
            <button md-raised-button (click)="refreshProcessList()"><md-icon>refresh</md-icon></button>
        </span>
    </div>
    <md-list dense class="process-list">
        <md-list-item *ngFor="let process of selectedSort.sortFunc() | filterByString:filterString:ProcessToString" class="process-list-item" (click)="ProcessClicked(process)">
            <md-icon md-list-avatar class="process-icon">settings_application</md-icon>
            <p md-line class="process-header">{{process.name}}</p>
            <p md-line class="process-subheader">ID: {{process.id}}</p>
        </md-list-item>
    </md-list>
</div>
`
})
export class ProcessListComponent implements OnInit {

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

    constructor(private debuggerService: DebuggerService) {
        let self = this;
        this.onProcessSelected = new EventEmitter<Process>();
        this.sortingOptions = [{
            name: 'Name',
            icon: 'arrow_drop_up',
            sortFunc: ()=>{return self.sortNameAscending()}
        },{
            name: 'Name',
            icon: 'arrow_drop_down',
            sortFunc: ()=>{return self.sortNameAscending().reverse()}
        },{
            name: 'ID',
            icon: 'arrow_drop_up',
            sortFunc: ()=>{return self.sortIDAscending()}
        }, {
            name: 'ID',
            icon: 'arrow_drop_down',
            sortFunc: ()=>{return self.sortIDAscending().reverse()}
        }
        ];
        this.selectedSort = this.sortingOptions[0];
        this.processes = [];
    }

	public ngOnInit() {
		this.refreshProcessList();
	}

	public refreshProcessList() {
		this.debuggerService.getProcesses()
			.subscribe(
				ps => { this.processes = ps; },
				err => { console.error(err); }
			);
	}

    public ProcessClicked(process:Process) {
        this.onProcessSelected.emit(process);
    }
    public ProcessToString(process:Process) {
        return process.name;
    }

    private sortNameAscending(): Process[] {
        if(this.processes) {
            this.processes.sort((a:Process, b:Process)=> {
                if(a.name < b.name) {
                    return -1;
                } else if(a.name > b.name) {
                    return 1;
                }
                return 0;
            });
        }

        return this.processes;
    }
    private sortIDAscending(): Process[] {
        if(this.processes) {
            this.processes.sort((a: Process, b: Process) => {
                if (a.id < b.id) {
                    return -1;
                } else if (a.id > b.id) {
                    return 1;
                }
                return 0;
            });
        }
        return this.processes;
    }

}
