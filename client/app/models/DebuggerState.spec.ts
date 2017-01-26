import { DebuggerState } from "./DebuggerState";
describe('DebuggerState', function () {

	let ds: DebuggerState;
	beforeEach(function () {
		ds = new DebuggerState('0');
	});

	describe('initialize', function() {
		it('should initialize source functions', function() {
			ds.initialize()
				.map(function(arg) {
					expect(arg).toBeNull();
					expect(ds.sourceVariables['0']).toBeDefined();
					expect(ds.sourceFunctions['0']).toBeDefined();
				});
		});
	});
});
