class ManualSegment{
    type="Name";/**[Product,Category,....ect] */
    ids=[];/**ids os selected elements acccording to select type  */
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

interface Conditions{
    type:string,/** table/field of comparison */
    condition:string,/** condition of comparison ["isEqual","isNotEqual","startsWith","endsWith","contains","notContain"] */ 
    value:any /** value of comparison */
    
}
class AutoSegment{
    match="all"/**[all,any] */
    conditions:Conditions[]=[]
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}


export class Segment{
    id="";
    title="";
    slug="";
    description=""
    type="Auto";/**[Manual,Auto] */
    data:ManualSegment|AutoSegment = new ManualSegment()
    createdAt= new Date()

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                if(key == 'data' && json["type"]=='Auto')
                {
                    let tempData = new AutoSegment()
                    tempData.ParseJson(json[key]);
                    this.data = tempData

                }else if (key == 'data' && json["type"]=='Manual')
                {
                    let tempData = new ManualSegment()
                    tempData.ParseJson(json[key]);
                    this.data = tempData
                }else{
                    this[key as keyof typeof this] = json[key];

                }
            }

        }
    }

}