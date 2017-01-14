import {NgModule} from "@angular/core";
import {FileSystemService} from "./file.system.service";

@NgModule({
    providers: [
        FileSystemService
    ]
})

export class ServiceModule {}