#!/usr/bin/env node
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,delimiter,resolve} from 'node:path';import {homedir} from 'node:os';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
// Remove only this product's explicitly marked old UI spike. Never disable an
// unknown plugin, replace credentials, or edit native hook approval records.
export async function removeLegacyPreview(directory=process.env.CLAUDE_CONFIG_DIR??join(homedir(),'.claude')) {
 const file=join(directory,'settings.json');let raw;
 try{raw=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return {removed:0};throw error;}
 const settings=JSON.parse(raw),value=settings.env?.CLAUDE_CODE_PLUGIN_DIRS;
 if(typeof value!=='string')return {removed:0};
 const paths=value.split(delimiter).filter(Boolean),keep=[];
 for(const path of paths){let old=false;try{const source=await readFile(join(path,'hooks/register.js'),'utf8');old=source.includes('// Capability spike only:')&&source.includes('Capability preview');}catch{}if(!old)keep.push(path);}
 const removed=paths.length-keep.length;if(!removed)return {removed:0};
 if(keep.length)settings.env.CLAUDE_CODE_PLUGIN_DIRS=keep.join(delimiter);else delete settings.env.CLAUDE_CODE_PLUGIN_DIRS;
 const id=randomUUID(),backup=join(directory,`settings.dontdumb-backup-${id}.json`),temp=join(directory,`settings.dontdumb-${id}.tmp`);
 await writeFile(backup,raw,{flag:'wx',mode:0o600});
 try{
  await writeFile(temp,JSON.stringify(settings,null,2)+'\n',{flag:'wx',mode:0o600});
  if(await readFile(file,'utf8')!==raw)throw new Error('Claude settings changed during migration; preserved them. Retry the installer.');
  await rename(temp,file);
 }finally{await unlink(temp).catch(()=>{});}
 return {removed,backup};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))removeLegacyPreview().then(result=>console.log(result.removed?'Removed obsolete LearningHarness capability preview; restart Claude.app after current work finishes.':'No obsolete LearningHarness preview configured.')).catch(()=>{console.error('Could not migrate the old LearningHarness preview. Existing settings were preserved.');process.exitCode=1;});
