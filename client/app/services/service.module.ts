import {NgModule} from "@angular/core";
import {FileSystemService} from "./file.system.service";
import {ViewService} from "./view.service";

@NgModule({
    providers: [
        FileSystemService,
        ViewService
    ]
})

export class ServiceModule {}