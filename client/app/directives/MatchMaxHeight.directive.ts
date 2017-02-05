import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';

@Directive({ selector: '[matchMaxHeight]' })

export class MatchMaxHeightDirective implements OnInit, OnDestroy {
	@Input('matchMaxHeight') matchId: string;
	protected actualHeight: string; //actual css "height" attribute value

	private static idMap: {[id: string]: {maxHeight: number, directives: MatchMaxHeightDirective[]}} = {};

	constructor(protected el: ElementRef) {
		this.actualHeight = "";
	}

	ngOnInit() {
		if(!MatchMaxHeightDirective.idMap[this.matchId]) {
			MatchMaxHeightDirective.idMap[this.matchId] = {maxHeight: 0, directives: []};
		}
		MatchMaxHeightDirective.idMap[this.matchId].directives.push(this);
	}

	ngOnDestroy() {
		MatchMaxHeightDirective.idMap[this.matchId].directives.filter(v => v !== this);
		if(MatchMaxHeightDirective.idMap[this.matchId].directives.length === 0) {
			delete MatchMaxHeightDirective.idMap[this.matchId];
		}
	}

	public static update(id: string): void {
		let selection = MatchMaxHeightDirective.idMap[id];
		if(!selection) {
			throw new Error(`MatchMaxHeightDirective: invalid id '${id}'`);
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

