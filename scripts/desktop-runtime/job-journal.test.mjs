import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,stat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobJournal} from './job-journal.mjs';

async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'lh-job-journal-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('restart retains completed results and marks pending work interrupted without replay',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await journal.create('done','chat-a');await journal.settle('done',{status:'ready',result:{lesson:'saved'}});await journal.create('waiting','chat-b');
 const resumed=await createJobJournal(dir);
 assert.deepEqual(resumed.get('done').result,{lesson:'saved'});assert.equal(resumed.get('done').chatId,'chat-a');
 assert.equal(resumed.get('waiting').status,'error');assert.match(resumed.get('waiting').error,/interrupted/i);
 assert.equal((await stat(join(dir,'jobs.json'))).mode&0o777,0o600);
 assert.equal((await stat(dir)).mode&0o777,0o700);
}));
test('a failed durable write rejects its caller without poisoning subsequent writes or committing memory',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await mkdir(join(dir,'jobs.json'));
 await assert.rejects(journal.create('failed','chat'));assert.equal(journal.get('failed'),undefined);
 await rm(join(dir,'jobs.json'),{recursive:true});await journal.create('next','chat');
 assert.equal(journal.get('next').status,'pending');assert.equal((await createJobJournal(dir)).get('failed'),undefined);
}));
test('retention keeps fifty terminal jobs and never evicts pending jobs',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await journal.create('pending','chat');
 for(let i=0;i<52;i++){await journal.create(`job-${i}`,'chat');await journal.settle(`job-${i}`,{status:'ready',result:i});}
 assert.equal(journal.get('pending').status,'pending');assert.equal(journal.get('job-0'),undefined);assert.equal(journal.get('job-1'),undefined);assert.equal(journal.get('job-2').result,2);assert.equal(journal.get('job-51').result,51);
}));
test('concurrent jobs retain identity and callers cannot mutate stored results',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await Promise.all([journal.create('a','one'),journal.create('b','two')]);
 await assert.rejects(journal.create('a','two'),/identity/i);await assert.rejects(journal.settle('missing',{status:'ready'}),/unavailable/i);
 await journal.settle('a',{status:'ready',result:{value:1}});const value=journal.get('a');value.result.value=9;
 assert.equal(journal.get('a').result.value,1);assert.equal(journal.get('b').chatId,'two');
}));

test('failed settlement leaves the pending operation durable and can be retried',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await journal.create('waiting','chat');
 const file=join(dir,'jobs.json'),backup=join(dir,'backup.json');await rename(file,backup);await mkdir(file);
 await assert.rejects(journal.settle('waiting',{status:'ready',result:{saved:true}}));assert.equal(journal.get('waiting').status,'pending');
 await rm(file,{recursive:true});await rename(backup,file);
 await journal.settle('waiting',{status:'ready',result:{saved:true}});
 assert.deepEqual((await createJobJournal(dir)).get('waiting').result,{saved:true});
}));
test('global settings operations retain explicit null scope across restart',()=>fixture(async dir=>{
 const journal=await createJobJournal(dir);await journal.create('global',null);await journal.settle('global',{status:'ready',result:{enabled:false}});
 assert.equal((await createJobJournal(dir)).get('global').chatId,null);
 await assert.rejects(journal.create('global','chat'),/identity/);
}));
