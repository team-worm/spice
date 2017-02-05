import { Directive, ElementRef, Input } from '@angular/core';

@Directive({ selector: '[matchMaxAttribute]' })

export class MatchMaxAttributeDirective {
	constructor(el: ElementRef) {
		//el.nativeElement.style.backgroundColor = 'yellow';
	}
}
