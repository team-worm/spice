import { Component, Input } from "@angular/core";
import { Trace } from "../../models/Trace";

@Component({
	selector: 'spice-trace',
	templateUrl: 'app/components/debugger/trace.component.html'
})

export class TraceComponent {
	@Input() trace: Trace;
	constructor() {
	}
}
