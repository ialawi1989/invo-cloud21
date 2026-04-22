

import queue from 'queue'



export class ViewQueue {

    viewQueue: queue;

    constructor() {
        this.viewQueue = new queue({ results: [] })
    }

    public static getQueue() {
        if (!instance) {

            instance = new ViewQueue();
        }
        return instance;
    }
    // 

    public pushJob() {
        // const data = { createdAt: new Date() };
        
        // let result = this.viewQueue.results != null ? this.viewQueue.results[0][0] :null;
        // const event = new Date();
        // let time  = event.getHours()  + ":" + event.getMinutes();

        // console.log(this.viewQueue.results?.find(f=> f == time));
      
        // this.viewQueue.push(function () {
        //     return new Promise(function (resolve, reject) {
        //         const event = new Date();
        //         let time  = event.getHours()  + ":" + event.getMinutes();
        //         resolve(time)
        //     })
        // })
        // console.log("push",this.viewQueue.results?.length)
        // this.viewQueue.emit('viewQueu', data)
    }

    public refreshView(){
        
    }
}

let instance: ViewQueue = new ViewQueue();
instance.viewQueue.autostart = true;

instance.viewQueue.on('viewQueu', async function (job) {
    try {


        //  DB.excu.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "InventoryMovmentRecords"`)
        //  DB.excu.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "JournalRecords"`)
      
         instance.viewQueue.results = instance.viewQueue.results?.filter((f=>f!="null" || f!=null ))??[];
        // const currentDate = new Date();
        // if (instance.viewQueue.results) {
        //     if (instance.viewQueue.results.length > 0) {
        //         for (let index = 0; index < instance.viewQueue.results.length; index++) {
        //             const element = instance.viewQueue.results[index];
                     
        //             if(element)
        //             {
        //                 if (element[0].createdAt.getTime() <= currentDate.getTime()) {

        //                     instance.viewQueue.results.pop()
                        
        //                 }
        //             }
                  
        //         }
        //     }
        // } 
    } catch (error) {
       
        console.log(error)
    }
 
})


