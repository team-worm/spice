import {Injectable} from "@angular/core";

@Injectable()
export class ViewService {

    private views:string[];

    private _activeView:string;

    constructor() {
        this.views = ['launcher','configuration','debugger'];
        this._activeView = this.views[0];
    }

    get activeView() {
        return this._activeView;
    }

    set activeView(view:string) {
        let lwView = view.toLowerCase();

        switch(lwView) {
            case 'launcher':
                this._activeView = lwView;
                break;
            case 'configuration':
                if(this.configurationViewAvailable) {
                    this._activeView = lwView;
                    return;
                }
                break;
            case 'debugger':
                if(this.debuggerViewAvailable) {
                    this._activeView = lwView;
                    return;
                }
                break;
            default:
                console.error('Attempt to set view to invalid value:', view);
        }
    }

    get configurationViewAvailable() {
        return true; //TODO: make return vary based on app state.
    }

    get debuggerViewAvailable() {
        return true; //TODO: make return vary based on app state.
    }


}