import {Pipe, Injectable, PipeTransform} from "@angular/core";

@Pipe({
    name: 'filterByString'
})
/* Filter */
@Injectable()
export class FilterByStringPipe implements PipeTransform {
    transform(items: any[], filterWord: string, transformFunction?:(i:any)=>string):any[] {

        if(!filterWord || filterWord.length == 0) {
            return items;
        }
        let fw = filterWord.toLowerCase();

        let tf:(i:any)=>string = (item:any) => {
            return item.toString();
        };
        if(transformFunction) {
            tf = transformFunction;
        }

        let outArr:any[] = [];

        for(let i = 0; i < items.length; i++) {
            let itemStr:string = tf(items[i]).toLowerCase();
            if(itemStr.includes(fw)){
                outArr.push(items[i]);
            }
        }
        return outArr;
    }
}