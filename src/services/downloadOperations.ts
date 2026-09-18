import { invoke } from "@tauri-apps/api/core";
const operations=new Map<string,{command:string;args:Record<string,unknown>}>();
export function trackedInvoke<T>(id:string,command:string,args:Record<string,unknown>):Promise<T>{operations.set(id,{command,args});return invoke<T>(command,args);}
export const hasDownloadRetry=(id:string)=>operations.has(id);
export const forgetDownload=(id:string)=>operations.delete(id);
export async function retryDownload(id:string){const operation=operations.get(id);if(!operation)throw new Error("Download is no longer available.");return {command:operation.command,result:await invoke(operation.command,operation.args)};}
