import {Component, OnInit} from "@angular/core";

@Component({
    selector: 'spice-configuration',
    templateUrl: 'app/components/configuration/configuration.component.html'
})
export class ConfigurationComponent implements OnInit {

    private _configurationContentBody:HTMLElement | null;

    public GetRowHeight():number {

        if(!this._configurationContentBody) {
            return 50;
        }

        return  ((window.innerHeight - this._configurationContentBody.offsetTop) / 4) - 4;

    }

    public ngOnInit() {
        this._configurationContentBody = document.getElementById('ConfigurationContainer');
        if(!this._configurationContentBody) {
            console.error('Error getting ConfigurationContainer');
        }



    }
}