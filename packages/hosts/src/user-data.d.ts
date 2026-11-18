export function userDataRoot(home?:string):string;
export function migrateLocalDirectory(source:string,destination:string,options?:{entries?:string[];omit?:string[]}):Promise<string>;
export function companionDirectory(options?:{host?:string;env?:Record<string,string|undefined>;home?:string}):Promise<string>;
export function nativeDirectory(options?:{host?:string;env?:Record<string,string|undefined>;home?:string}):Promise<string>;
