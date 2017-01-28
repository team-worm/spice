import {Component} from "@angular/core";

@Component({
    selector: 'spice-configuration',
    template: `
<h4>Config your stuff here like functions and types.</h4>
<md-grid-list cols="3" rowHeight="170px">
    <md-grid-tile [colspan]="1" [rowspan]="4" [style.background]="'lightpink'">Function Picker</md-grid-tile>
    <md-grid-tile [colspan]="2" [rowspan]="1" [style.background]="'lightblue'">SourceType Stuff</md-grid-tile>
    <md-grid-tile [colspan]="2" [rowspan]="3" [style.background]="'lightgreen'">Source Viewer</md-grid-tile>
</md-grid-list>
`
})
export class ConfigurationComponent {}