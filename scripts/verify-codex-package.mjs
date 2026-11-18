import { request } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const temp=await mkdtemp(join(tmpdir(),'dd-cleanroom-'));
const archive=resolve(process.argv[2]??'artifacts/dontdumb-codex-beta-0.1.0-beta.16.tgz');
const fake=join(temp,'codex');
const opener=join(temp,process.platform==='darwin'?'open':'xdg-open');
await writeFile(opener,`#!/bin/sh
printf '%s\\n' "$1" >> "$DONTDUMB_TEST_OPEN_LOG"
`);await chmod(opener,0o755);
await writeFile(fake,`#!${process.execPath}
let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))!==-1){const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);if(m.id===undefined)continue;let result={};if(m.method==='account/read')result={account:{type:'chatgpt',planType:'fixture'}};else if(m.method==='model/list')result={data:[{model:'fixture',isDefault:true}]};else if(m.method==='thread/list')result={data:[{id:'fixture-chat',cwd:'/fixture/project',name:'Fixture work'}]};else if(m.method==='turn/start')throw Error('INFERENCE FORBIDDEN');else if(m.method!=='initialize')throw Error('Unexpected method '+m.method);process.stdout.write(JSON.stringify({id:m.id,result})+'\\n');}});
`);await chmod(fake,0o755);
const env={...process.env,PATH:temp+':'+process.env.PATH,DONTDUMB_TEST_OPEN_LOG:join(temp,'opened'),DONTDUMB_NODE_BIN:process.execPath,DONTDUMB_CODEX_BIN:fake,DONTDUMB_STATE_DIR:join(temp,'state'),DONTDUMB_POSTHOG_TOKEN:'disabled',npm_config_cache:join(temp,'cache')};
const run=(args)=>execFileSync(process.execPath,[join(temp,'node_modules/dontdumb-codex-beta/bin/dontdumb.mjs'),...args],{env,encoding:'utf8',timeout:25000});
try {
 execFileSync('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund',archive],{cwd:temp,env,stdio:'pipe'});
 assert.match(execFileSync(join(temp,'node_modules/.bin/dontdumb'),['--doctor'],{env,encoding:'utf8'}),/No inference/);
 const link=run(['--no-open','--mobile-origin','https://device.example.ts.net:10000']).trim();const url=new URL(link);const token=url.hash.slice(1);
 const api=async(path,input={},extra={})=>fetch(url.origin+'/api/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(input)});
 const bootstrap=await(await api('bootstrap')).json();assert.equal(bootstrap.project,null);assert.deepEqual(bootstrap.projects,['/fixture/project']);assert.deepEqual(bootstrap.threads,[]);assert.equal(new URL(bootstrap.mobileURL).origin,'https://device.example.ts.net:10000');
 assert.equal(await new Promise((done,reject)=>{const req=request(url.origin+'/api/health',{method:'POST',headers:{Host:'device.example.ts.net:10000',Origin:'https://device.example.ts.net:10000',Authorization:'Bearer '+token}},res=>{res.resume();done(res.statusCode)});req.on('error',reject);req.end('{}')}),200);
 assert.equal((await api('bootstrap',{}, {Origin:'https://evil.example'})).status,403);
 assert.equal((await fetch(url.origin+'/api/status',{method:'POST'})).status,403);
 assert.equal(await new Promise((done,reject)=>{const req=request(url.origin,{headers:{Host:'evil.example'}},res=>{res.resume();done(res.statusCode)});req.on('error',reject);req.end()}),403);
 assert.match(await(await fetch(url.origin)).text(),/<html/);
 assert.equal((await api('project',{project:'/not-selected'})).status,400);
 assert.equal((await api('project',{project:'/fixture/project'})).status,200);
 const selected=await(await api('bootstrap')).json();assert.equal(selected.threads[0].id,'fixture-chat');
 assert.equal((await stat(join(temp,'state/companion.json'))).mode&0o777,0o600);
 const before=(await(await api('status')).json()).openRequest;
 assert.equal(run([]).trim(),link);
 assert.equal((await(await api('status')).json()).openRequest,before+1);
 assert.equal((await fetch(url.origin+'/api/open',{method:'POST'})).status,403);
 assert.equal((await readFile(join(temp,'opened'),'utf8')).trim(),link);
 if(process.platform==='darwin') assert.match(execFileSync(join(temp,'node_modules/dontdumb-codex-beta/bin/start'),['--doctor'],{env:{...env,PATH:'/usr/bin:/bin'},encoding:'utf8'}),/No inference/);
 assert.match(run(['--stop']),/stopped/);
 await new Promise(r=>setTimeout(r,300));
 await assert.rejects(readFile(join(temp,'state/writer.lock')));
 await assert.rejects(readFile(join(temp,'state/companion.json')));
 console.log('PASS: offline tarball install, bundled doctor, no-inference startup/project picker, protected API, reuse, private control file, authenticated shutdown and lock cleanup.');
} catch(error) { console.error(await readFile(join(temp,'state/companion.log'),'utf8').catch(()=>'')); throw error; } finally { try{run(['--stop']);}catch{} await rm(temp,{recursive:true,force:true}); }
