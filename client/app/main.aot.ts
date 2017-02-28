import { platformBrowser } from '@angular/platform-browser';
import { enableProdMode } from '@angular/core';
import { SpiceModuleNgFactory } from '../aot/app/spice.module.ngfactory';

enableProdMode();

platformBrowser().bootstrapModuleFactory(SpiceModuleNgFactory as any);
