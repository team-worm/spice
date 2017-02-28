import { Component, Input } from "@angular/core";
import { Trace } from "../../models/Trace";

@Component({
    moduleId: module.id,
	selector: 'spice-trace',
	templateUrl: './trace.component.html'
})

export class TraceComponent {
	@Input() trace: Trace;
	constructor() {
	}
}
