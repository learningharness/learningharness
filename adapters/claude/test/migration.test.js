import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {join,delimiter} from 'node:path';import {tmpdir} from 'node:os';
import {removeLegacyPreview} from '../plugin/bin/migrate.mjs';
test('upgrade removes only the confirmed obsolete preview and preserves unrelated configuration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-legacy-'));try{
 const old=join(dir,'old-preview'),other=join(dir,'other-plugin');await mkdir(join(old,'hooks'),{recursive:true});await writeFile(join(old,'hooks/register.js'),'// Capability spike only: no model calls\nconst text="Capability preview — scripted content";');
 const original={env:{CLAUDE_CODE_PLUGIN_DIRS:[old,other].join(delimiter),OTHER:'preserve'},enabledPlugins:{'dontdumb@dontdumb-local':true},permissions:{allow:['Read']}};
 await writeFile(join(dir,'settings.json'),JSON.stringify(original));
 const result=await removeLegacyPreview(dir);assert.equal(result.removed,1);assert.ok(result.backup);
 assert.deepEqual(JSON.parse(await readFile(result.backup,'utf8')),original);
 const current=JSON.parse(await readFile(join(dir,'settings.json'),'utf8'));assert.equal(current.env.CLAUDE_CODE_PLUGIN_DIRS,other);assert.equal(current.env.OTHER,'preserve');assert.deepEqual(current.permissions,original.permissions);assert.deepEqual(current.enabledPlugins,original.enabledPlugins);
 assert.equal((await removeLegacyPreview(dir)).removed,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('unknown plugins and corrupt settings are never rewritten',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-legacy-invalid-'));try{
 const file=join(dir,'settings.json');await writeFile(file,'broken');await assert.rejects(removeLegacyPreview(dir));assert.equal(await readFile(file,'utf8'),'broken');
 await writeFile(file,JSON.stringify({env:{CLAUDE_CODE_PLUGIN_DIRS:'/unrecognized/plugin'}}));const before=await readFile(file,'utf8');assert.equal((await removeLegacyPreview(dir)).removed,0);assert.equal(await readFile(file,'utf8'),before);
 }finally{await rm(dir,{recursive:true,force:true})}
});
