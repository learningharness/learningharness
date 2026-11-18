import {mkdirSync,readFileSync,writeFileSync,renameSync,unlinkSync,openSync,closeSync} from 'node:fs';
import {join} from 'node:path';
// Multiple host connections share one counter. Only actual timer callbacks earn ticks.
export function createStore(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const file=join(directory,'state.json'), lock=join(directory,'writer.lock');
 const read=()=>{try{return JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {on:false,ticks:0,lastTick:0};throw e;}};
 function change(fn){
  let fd;
  try{fd=openSync(lock,'wx',0o600);writeFileSync(fd,String(process.pid));}
  catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(readFileSync(lock,'utf8'));if(pid>0){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH'){unlinkSync(lock);return change(fn);}}}throw Error('Settings are busy; retry.');}
  try{const state=read();fn(state);const temporary=file+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify(state),{mode:0o600});renameSync(temporary,file);return state;}
  finally{closeSync(fd);unlinkSync(lock);}
 }
 return {read,setSessionLauncher(value){if(typeof value!=='boolean')throw Error('Session launcher must be on or off');return change(s=>{s.showSessionLauncher=value;});},completeSetup(){return change(s=>{s.setup={completedAt:Date.now()};s.on=true;});},set(on){if(typeof on!=='boolean')throw Error('on must be boolean');return change(s=>{s.on=on;});},tick(now=Date.now()){const current=read();if(!current.on||now-current.lastTick<1000)return current;return change(s=>{if(s.on&&now-s.lastTick>=1000){s.ticks++;s.lastTick=now;}});}};
}
