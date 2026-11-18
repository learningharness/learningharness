import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {entryStatus} from './entry-status.mjs';
const id='12345678-1234-4234-8234-123456789abc';
test('footer reads exact chat readiness and Off, without a runtime or inference',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lh-entry-status-'));try{
 await writeFile(join(directory,'state.json'),'{"on":false}');assert.equal(entryStatus(id,{directory}),'off');
 await writeFile(join(directory,'state.json'),'{"on":true}');assert.equal(entryStatus(id,{directory}),'on');
 await writeFile(join(directory,'chain-'+id+'.json'),JSON.stringify({status:'ready',preparedTarget:{id:'saved'}}));assert.equal(entryStatus(id,{directory}),'ready');assert.equal(entryStatus('22345678-1234-4234-8234-123456789abc',{directory}),'on');
 await writeFile(join(directory,'chain-'+id+'.json'),JSON.stringify({status:'stale',preparedTarget:{id:'saved'}}));assert.equal(entryStatus(id,{directory}),'on');assert.equal(entryStatus('../escape',{directory}),'unavailable');
 }finally{await rm(directory,{recursive:true,force:true});}
});
