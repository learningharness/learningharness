import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
// Read-only process identity. A session resume or plugin worker restart is not
// evidence that the desktop app was reopened. Unknown identity fails quiet.
export function desktopLaunch(){
 if(process.platform!=='darwin')return null;
 try{
  const found=[];
  const options={encoding:'utf8',timeout:250,stdio:['ignore','pipe','ignore']};
  const rows=execFileSync('/bin/ps',['-U',String(process.getuid()),'-o','pid=,comm='],options).split('\n');
  for(const row of rows){
   const match=row.match(/^\s*(\d+)\s+(\/Applications\/(?:ChatGPT|Codex)\.app\/Contents\/MacOS\/(?:ChatGPT|Codex))\s*$/);
   if(!match)continue;
   const [,pid,path]=match,start=execFileSync('/bin/ps',['-p',pid,'-o','lstart='],options).trim(),startedAt=Date.parse(start);
   if(Number.isFinite(startedAt))found.push({id:createHash('sha256').update(path+pid+start).digest('hex'),startedAt});
  }
  return found.length===1?found[0]:null;
 }catch{return null;}
}
