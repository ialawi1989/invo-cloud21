export class Employee {
    id =""; 
    name =""; 
    email:string|null;
    password=""; 
    companyId=""; 
    createdAt= new Date(); 
    admin= false;
    user=false;
    superAdmin = false;
    companyGroupId:string|null;
    branchId="";
    passCode="";
    base64Image="";
    defaultImage="";
    updatedDate=new Date();
    mediaUrl={}
    mediaId:string|null;
    privilegeId:string|null;
    branches:any[]=[]
    isDriver: boolean = false;
 
    //cloud user, invented user , delivery 
    type:  string = 'Cloud User'

    MSR="";

    resetPasswordDate:null|Date;

    dashBoardOptions:null|any;
    sessionId : string|null;
    inventionEndAt: Date  | null= null;
    inventionStartAt: Date| null= null;
    default : boolean = false

    apply2fa: null|Boolean = null; 
    hasPermissionToChange2fa: boolean = false;    constructor(){
        this.companyGroupId = null
        this.mediaId = null
        this.privilegeId = null
        this.email = null
        this.resetPasswordDate = null;
        this.dashBoardOptions = null ;
        this.sessionId = null
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}