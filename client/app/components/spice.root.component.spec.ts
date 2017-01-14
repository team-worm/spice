import {SpiceRootComponent} from './spice.root.component';

import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {By}           from '@angular/platform-browser';
import {DebugElement} from '@angular/core';

describe('SpiceRootComponent', function () {
    let de: DebugElement;
    let comp: SpiceRootComponent;
    let fixture: ComponentFixture<SpiceRootComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [SpiceRootComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(SpiceRootComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement.query(By.css('h1'));
    });

    it('should create component', () => expect(comp).toBeDefined());

    it('should have expected <h1> text', () => {
        fixture.detectChanges();
        const h1 = de.nativeElement;
        expect(h1.innerText).toMatch(/angular/i,
            '<h1> should say something about "Angular"');
    });
});
