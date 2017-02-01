import {async, ComponentFixture, TestBed, inject} from '@angular/core/testing';
import { By }           from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import {SpiceRootComponent} from "./spice-root.component";
import {SpiceModule} from "../spice.module";
import {ViewService} from "../services/view.service";

describe('A Service', function () {


    let comp: SpiceRootComponent;
    let fixture: ComponentFixture<SpiceRootComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            imports: [SpiceModule]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(SpiceRootComponent);
        comp = fixture.componentInstance;
    });

    it('should create SpiceRootComponent', () => expect(comp).toBeDefined() );

    it('should have the toolbar defined', () => {
        let el: DebugElement;
        el = fixture.debugElement.query(By.css('spice-toolbar'));
        fixture.detectChanges();
        const toolbar = el.nativeElement;
        expect(toolbar).toBeDefined();
    });
    it('should have the launcher defined', () => {
        let el: DebugElement;
        el = fixture.debugElement.query(By.css('spice-launcher'));
        fixture.detectChanges();
        const launcher = el.nativeElement;
        expect(launcher).toBeDefined();
    });
    it('should have the configuration defined', () => {
        let el: DebugElement;
        el = fixture.debugElement.query(By.css('spice-configuration'));
        fixture.detectChanges();
        const launcher = el.nativeElement;
        expect(launcher).toBeDefined();
    });
    it('should have the debugger defined', () => {
        let el: DebugElement;
        el = fixture.debugElement.query(By.css('spice-debugger'));
        fixture.detectChanges();
        const launcher = el.nativeElement;
        expect(launcher).toBeDefined();
    });

    it('should be in the Launcher view on start', ()=> {
        expect(fixture.componentInstance.IsInLauncher()).toBeTruthy();
        expect(fixture.componentInstance.IsInConfiguration()).toBeFalsy();
        expect(fixture.componentInstance.IsInDebugger()).toBeFalsy();
    });
    it('should change view methods if the view changes', inject([ViewService],(vs:ViewService) => {
        vs.activeView = 'configuration';
        expect(fixture.componentInstance.IsInLauncher()).toBeFalsy();
        expect(fixture.componentInstance.IsInConfiguration()).toBeTruthy();
        expect(fixture.componentInstance.IsInDebugger()).toBeFalsy();
        vs.activeView = 'debugger';
        expect(fixture.componentInstance.IsInLauncher()).toBeFalsy();
        expect(fixture.componentInstance.IsInConfiguration()).toBeFalsy();
        expect(fixture.componentInstance.IsInDebugger()).toBeTruthy();
        vs.activeView = 'launcher';
        expect(fixture.componentInstance.IsInLauncher()).toBeTruthy();
        expect(fixture.componentInstance.IsInConfiguration()).toBeFalsy();
        expect(fixture.componentInstance.IsInDebugger()).toBeFalsy();
    }));
});
