import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,writeFile,lstat,unlink,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {issueChatBinding,resolveChatBinding} from '../src/chat-binding.js';

const chat='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const hash=value=>createHash('sha256').update(value).digest('hex');
const descriptor=(directory,id)=>join(directory,'sessions',hash(id)+'.json');
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'lh-claude-binding-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function files(directory){const out=[];for(const item of await readdir(directory,{withFileTypes:true})){const path=join(directory,item.name);if(item.isDirectory())out.push(...await files(path));else out.push(path);}return out;}

test('exact chat binding survives module reload and preserves a private session descriptor',async t=>{
 const directory=await fixture(t);
 const token=await issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/project',prompt:'DO_NOT_SAVE_WORK',transcript_path:'/DO_NOT_READ_TRANSCRIPT'});
 assert.match(token,/^[a-f0-9]{64}$/);
 assert.notEqual(token,hash(chat),'binding must not be predictable from the public chat ID');
 const reloaded=await import('../src/chat-binding.js?fresh-binding-test');
 assert.equal(await reloaded.issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/project'}),token);
 assert.equal(await reloaded.resolveChatBinding(directory,token),chat);
 const session=JSON.parse(await readFile(descriptor(directory,chat),'utf8'));
 assert.equal(session.id,chat);assert.equal(session.cwd,'/synthetic/project');assert(Number.isFinite(session.at));
 for(const file of await files(directory)){
  const stored=await readFile(file,'utf8');
  assert(!stored.includes('DO_NOT_SAVE_WORK'));assert(!stored.includes('DO_NOT_READ_TRANSCRIPT'));
  assert.equal((await lstat(file)).mode&0o077,0,`private file: ${file}`);
 }
});

test('parallel chat starts never cross-bind and concurrent same-chat issuance is stable',async t=>{
 const directory=await fixture(t);
 const tokens=await Promise.all(Array.from({length:12},(_,index)=>issueChatBinding(directory,{session_id:index%2?chat:other,cwd:index%2?'/synthetic/a':'/synthetic/b'})));
 const a=tokens.filter((_,index)=>index%2),b=tokens.filter((_,index)=>!(index%2));
 assert.equal(new Set(a).size,1);assert.equal(new Set(b).size,1);assert.notEqual(a[0],b[0]);
 assert.equal(await resolveChatBinding(directory,a[0]),chat);
 assert.equal(await resolveChatBinding(directory,b[0]),other);
});

test('missing or forged binding never falls back to metadata or a recently active chat',async t=>{
 const directory=await fixture(t);
 await issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/a'});
 await issueChatBinding(directory,{session_id:other,cwd:'/synthetic/b'});
 for(const token of [undefined,null,'',chat,'../sessions/'+hash(chat),'a'.repeat(63),'a'.repeat(64)]){
  await assert.rejects(resolveChatBinding(directory,token,{session_id:other}));
 }
});

test('a real binding accepts matching metadata but rejects conflicting chat identities',async t=>{
 const directory=await fixture(t),token=await issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/a'});
 assert.equal(await resolveChatBinding(directory,token,{session_id:chat}),chat);
 await assert.rejects(resolveChatBinding(directory,token,{session_id:other}));
 await assert.rejects(resolveChatBinding(directory,token,{session_id:chat,thread_id:other}));
});

test('invalid hook identities, nonabsolute project paths and subagent contexts cannot issue bindings',async t=>{
 const directory=await fixture(t);
 for(const input of [{session_id:'../escape',cwd:'/synthetic/a'},{session_id:chat,cwd:'relative'},{session_id:chat,cwd:''},{session_id:chat,cwd:'/synthetic/a',agent_id:'subagent-one'},{session_id:chat}]){
  await assert.rejects(issueChatBinding(directory,input));
 }
});

test('binding resolution refuses missing, cross-chat and symlinked session descriptors',async t=>{
 const directory=await fixture(t),token=await issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/a'});
 const path=descriptor(directory,chat),original=await readFile(path,'utf8');
 await writeFile(path,JSON.stringify({id:other,cwd:'/synthetic/a',at:Date.now()}));
 await assert.rejects(resolveChatBinding(directory,token));
 await unlink(path);await assert.rejects(resolveChatBinding(directory,token));
 const elsewhere=join(directory,'external-descriptor.json');await writeFile(elsewhere,original,{mode:0o600});await symlink(elsewhere,path);
 await assert.rejects(resolveChatBinding(directory,token));
});

test('corrupted persisted binding records fail closed rather than selecting another chat',async t=>{
 const directory=await fixture(t),token=await issueChatBinding(directory,{session_id:chat,cwd:'/synthetic/a'});
 const records=(await files(directory)).filter(file=>!file.startsWith(join(directory,'sessions')+'/'));
 assert(records.length>0,'binding must have a persisted registry, not process-global state');
 for(const path of records)await writeFile(path,'{broken-json');
 await assert.rejects(resolveChatBinding(directory,token));
});
