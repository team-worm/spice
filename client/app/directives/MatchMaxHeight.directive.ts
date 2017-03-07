import { Directive, ElementRef, Input, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { Observable } from "rxjs/Observable";

const dirtyDuration = 150; //Leave ids marked dirty for this many ms to ensure that they get updated after render
const dirtyUpdateInterval = 50; //only actually update dirty rows every interval

@Directive({ selector: '[matchMaxHeight]' })
export class MatchMaxHeightDirective implements OnInit, OnChanges, OnDestroy {
	@Input('matchMaxHeight') matchId: string;
	protected actualHeight: string; //actual css "height" attribute value

	private static idMap: {[id: string]: {maxHeight: number, directives: MatchMaxHeightDirective[]}} = {};
	private static dirtyMap = new Map<string,number>(); //id: refresh time remaining
	private static dirtyWait = false;

	constructor(protected el: ElementRef) {
		this.actualHeight = "";
	}

	ngOnInit() {
		//this.registerDirective(this.matchId);
	}

	ngOnChanges(changes: any) {
		this.unregisterDirective(changes.matchId.previousValue);
		this.registerDirective(changes.matchId.currentValue);
	}

	ngOnDestroy() {
		this.unregisterDirective(this.matchId);
	}

	protected registerDirective(id: string) {
		if(!MatchMaxHeightDirective.idMap[id]) {
			MatchMaxHeightDirective.idMap[id] = {maxHeight: 0, directives: []};
		}
		MatchMaxHeightDirective.idMap[id].directives.push(this);
		MatchMaxHeightDirective.markDirty(id);
	}

	protected unregisterDirective(id: string) {
		if(!MatchMaxHeightDirective.idMap[id]) {
			return;
		}
		MatchMaxHeightDirective.idMap[id].directives = MatchMaxHeightDirective.idMap[id].directives.filter(v => v !== this);
		if(MatchMaxHeightDirective.idMap[id].directives.length === 0) {
			delete MatchMaxHeightDirective.idMap[id];
			MatchMaxHeightDirective.dirtyMap.delete(id);
		}
	}

	public static markDirty(id: string): void {
		if(MatchMaxHeightDirective.dirtyMap.size === 0) {
			let dirtyUpdateSubscription = Observable.interval(dirtyUpdateInterval).subscribe(() => {
				if(MatchMaxHeightDirective.dirtyMap.size === 0) {
					dirtyUpdateSubscription.unsubscribe();
					return;
				}

				MatchMaxHeightDirective.dirtyMap.forEach((time, id) => {
					MatchMaxHeightDirective.update(id);
					let newTime = time - dirtyUpdateInterval;
					if(newTime <= 0) {
						MatchMaxHeightDirective.dirtyMap.delete(id);
					} else {
						MatchMaxHeightDirective.dirtyMap.set(id, newTime);
					}
				});
			});
		}

		MatchMaxHeightDirective.dirtyMap.set(id, dirtyDuration);
	}

	public static update(id: string): void {
		let selection = MatchMaxHeightDirective.idMap[id];
		if(!selection) {
			return;
			//throw new Error(`MatchMaxHeightDirective: invalid id '${id}'`);
		}
		//restore old heights
		selection.directives.forEach(v => {
			//update actualHeight if the height attribute appears changed
			//NOTE: known bug where if the user sets height exactly to the current max height, we can't tell and clobber the user's value
			let heightAttribute = v.el.nativeElement.style.height;
			if(heightAttribute !== `${selection.maxHeight}px`) {
				v.actualHeight = heightAttribute;
			}

			//restore height
			v.el.nativeElement.style.height = v.actualHeight;
		});
		
		//calculate new max height
		selection.maxHeight = selection.directives.reduce((max, v) => Math.max(max, MatchMaxHeightDirective.outerHeight(v.el)), 0);
		//set heights to max height
		selection.directives.forEach(v => {
			v.el.nativeElement.style.height = `${selection.maxHeight}px`;
		});
	}
	
	private static outerHeight(el: ElementRef) {
		var height = el.nativeElement.offsetHeight;
		//var style = getComputedStyle(el);

		//height += parseInt(style.marginTop) + parseInt(style.marginBottom);
		return height;
	}
}

