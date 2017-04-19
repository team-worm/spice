import { Directive, ElementRef, Input, AfterViewInit } from '@angular/core';

@Directive({ selector: '[paramFocus]' })

export class ParameterFocusDirective implements AfterViewInit {
    private element: ElementRef;
    constructor(el: ElementRef) {
        this.element = el;
    }

    ngAfterViewInit() {
        window.setTimeout(() => {
            this.element.nativeElement.focus();
        }, 1000);
    }
}
