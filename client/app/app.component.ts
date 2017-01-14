import {Component} from '@angular/core';
import {TraceOfIntruction} from "./models/trace/TraceOfIntruction";
import {ExecutionOfProcess} from "./models/execution/ExecutionOfProcess";

@Component({
    selector: 'spice-root',
    template: `<h1>Hello {{name}}</h1>`,
})
export class AppComponent {
    name = 'Angular';

    constructor() {
        let v = new TraceOfIntruction();
        let z = new ExecutionOfProcess();
        this.name = 'sam';
    }
}
