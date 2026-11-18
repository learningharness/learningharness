import {readFileSync} from 'node:fs';
import {join,dirname,isAbsolute} from 'node:path';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
import {fileURLToPath} from 'node:url';
// UI-only, read-only status. The installer records the same root used by hooks
// and MCP; never fall back to a different learner store or start the service.
export function entryStatus(id,{directory,env=process.env}={}){
 if(!validSessionId(id))return 'unavailable';
 directory??=env.LEARNING_HARNESS_DATA_DIR??env.DONTDUMB_PROBE_DATA;
 if(!directory){try{directory=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'entry-state.json'),'utf8')).directory;}catch{return 'unavailable';}}
 if(typeof directory!=='string'||!isAbsolute(directory))return 'unavailable';
 try{
  if(!JSON.parse(readFileSync(join(directory,'state.json'),'utf8')).on)return 'off';
 }catch{return 'unavailable';}
 try{
  const chain=JSON.parse(readFileSync(join(directory,'chain-'+id+'.json'),'utf8'));
  return chain?.status==='ready'&&chain.preparedTarget?'ready':'on';
 }catch{return 'on';}
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(entryStatus(process.argv[2]));
