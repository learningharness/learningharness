import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {learnerDirectory} from '../../learning/src/user-memory.js';import {learnerStore} from '../../learning/src/learner-store.js';
test('memory migration preserves canonical profile, merges old attempts and keeps old profile backup',async()=>{
 const home=await mkdtemp(join(tmpdir(),'lh-memory-migration-'));const old=join(home,'.local/share/dontdumb'),next=join(home,'.local/share/learning-harness/learner');
 try{const a=learnerStore(old),b=learnerStore(next);await a.saveProfile({goals:['Old goal'],known:[],preferences:''});await a.mergeEvidence('claude',[{id:'a',objective:'Retries',verdict:'partial',createdAt:'2026-11-03T00:00:00Z'}]);await b.saveProfile({goals:['Current goal'],known:[],preferences:''});
  assert.equal(await learnerDirectory({home,env:{}}),next);await learnerDirectory({home,env:{}});const s=await b.read();assert.deepEqual(s.profile.goals,['Current goal']);assert.equal(s.evidence.length,1);assert.equal(s.evidence[0].id,'claude:a');assert.deepEqual(s.evidence[0],(await a.read()).evidence[0]);assert.deepEqual(JSON.parse(await readFile(join(next,'migration-backup/learner.json'),'utf8')).profile.goals,['Old goal']);assert.equal(await learnerDirectory({home,env:{LEARNING_HARNESS_LEARNER_DIR:'/custom'}}),'/custom');
 }finally{await rm(home,{recursive:true,force:true});}
});
