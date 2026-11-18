// Synthetic native shortcut acceptance fixture: never imports or starts a real host.
import {createServer} from 'node:net';
import {mkdtemp,writeFile,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
const chat='11111111-1111-4111-8111-111111111111',job='22222222-2222-4222-8222-222222222222';
export async function startShortcutFixture(){
 const directory=await mkdtemp(join(tmpdir(),'lh-native-keys-')),socketPath=join(directory,'core.sock'),journal=[];let enabled=true;
 const server=createServer({allowHalfOpen:true},socket=>{
  let body='';socket.on('error',()=>{});
  socket.on('data',chunk=>{body+=chunk;if(body.length>8192)socket.destroy();});
  socket.on('end',async()=>{
   try{
    const {method,params={}}=JSON.parse(body);let result;
    if(method==='desktop-status')result={enabled,stopped:false};
    else if(method==='desktop-chats')result={enabled,chats:[{id:chat,title:'Shortcut acceptance — synthetic chat',project:'Isolated fixture',paused:false}]};
    else if(method==='desktop-action'&&['on','off'].includes(params.action)){enabled=params.action==='on';result={enabled};}
    else if(method==='desktop-action'&&params.action==='new-moment'&&params.id===chat&&enabled)result={job,id:chat};
    else if(method==='desktop-job'&&params.id===chat&&params.job===job)result={status:'ready'};
    else throw Error('Fixture rejects unknown actions or chat identities.');
    journal.push({method,params,result});await writeFile(join(directory,'requests.json'),JSON.stringify(journal,null,2),{mode:0o600});
    socket.end(JSON.stringify({result}));
   }catch(error){socket.end(JSON.stringify({error:String(error.message)}));}
  });
 });
 await new Promise((done,fail)=>{server.once('error',fail);server.listen(socketPath,done);});
 return {directory,journal,close:async()=>{await new Promise(done=>server.close(done));await unlink(socketPath).catch(()=>{});}};
}
export async function prepareNativeAcceptance(){
 const fixture=await startShortcutFixture(),output=join(fixture.directory,'build');
 try{
  await promisify(execFile)(process.execPath,['scripts/desktop-controls/build.mjs'],{env:{...process.env,LH_DESKTOP_HOST:'claude',LH_DESKTOP_DATA_DIR:fixture.directory,LH_DESKTOP_OUTPUT:output,LH_DESKTOP_TEST:'1',LH_DESKTOP_DIAGNOSTICS:'1'}});
  const manifest={fixtureDirectory:fixture.directory,app:join(output,'LearningHarness Claude Controls.app'),journal:join(fixture.directory,'requests.json'),host:'claude',bundle:'dev.learningharness.controls.test.claude',synthetic:true};
  await writeFile(join(fixture.directory,'acceptance.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  return {...fixture,manifest};
 }catch(error){await fixture.close();throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const fixture=await prepareNativeAcceptance();console.log(JSON.stringify(fixture.manifest));
 const stop=async()=>{await fixture.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
