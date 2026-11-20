// Synthetic MCP Apps host for presentation checks. No models, hooks or learner files.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const base=new URL('./dist/',import.meta.url);
let html=readFileSync(new URL('index.html',base),'utf8');
html=html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/,(_,path)=>`<script type="module">${readFileSync(new URL(path.replace(/^\//,''),base),'utf8')}</script>`).replace(/<link[^>]+href="([^"]+)"[^>]*>/,(_,path)=>`<style>${readFileSync(new URL(path.replace(/^\//,''),base),'utf8')}</style>`);
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','text/html; charset=utf-8');
 if(url.pathname==='/app'){let app=html;if(url.searchParams.has('invitation'))app=app.replace('<html','<html data-invitation="true"');if(url.searchParams.has('claude'))app=app.replace('<html','<html data-learning-host="claude"');return res.end(app);}
 res.end(`<!doctype html><html lang="en"><head><title>Inline learning: synthetic host</title></head><body style="margin:0;background:#111;color:#ddd;font:14px system-ui"><div id="shell" style="display:flex"><iframe title="LearningHarness inline" id="app" style="border:0;width:100%;height:100vh"></iframe></div><script>
 const params=new URLSearchParams(location.search),onboarding=params.has('onboarding'),claude=params.has('claude'),invitationId='11111111-1111-4111-8111-111111111111';
 const lesson={id:'fixture-moment',invitationId,kind:'predict',title:'One signal, two places to stop',objective:'Cancellation across the retry wait',body:'The request and the wait are separate asynchronous steps. Both need the same cancellation signal.',question:'What should happen when cancellation arrives during the retry wait?',choices:['Reject the wait and stop retrying','Run one more request','Cancel only the current fetch']};
 window.fixture={calls:[],state:{enabled:!onboarding,globallyStopped:false,revision:1,setup:onboarding?null:{completedAt:1},settings:{allowInline:!params.has('sidebar'),sensitivity:'learn-balanced'},capabilities:{host:claude?'claude':'codex',surface:{}},learner:{profile:{goals:[],known:[],preferences:''}},usage:{input:0,output:0,calls:0},history:[{id:'earlier',sessionID:'fixture',title:'Why a timer survives a cancelled request',body:'Cancelling fetch does not cancel an unrelated timeout.',question:'Which operation still needs a signal?',feedback:{answer:'The wait',feedback:'Yes. Pass the signal to both operations.'}}],session:{id:'fixture',phase:'ready',moment:null,usage:{input:0,output:0}}}};
 if(params.has('heavy'))Object.assign(lesson,{kind:'demonstrate',question:undefined,experiment:{type:'synthetic',title:'Full visual'}});
 const state=fixture.state,jobs={},app=document.getElementById('app');app.src='/app'+(onboarding?'':'?invitation')+(claude?(onboarding?'?':'&')+'claude':'');
 window.addEventListener('message',e=>{
 const frames=[...document.querySelectorAll('iframe')],frame=frames.find(f=>f.contentWindow===e.source);if(!frame)return;const m=e.data;
 if(m.method==='ui/notifications/size-changed'&&frame===app&&!onboarding)app.style.height=Math.max(40,m.params.height)+'px';
 if(m.id===undefined)return;fixture.calls.push({method:m.method,params:m.params});let result={};const fullscreen=frame.id==='sidebar';
 if(m.method==='ui/initialize'){result={hostContext:{displayMode:fullscreen?'fullscreen':'inline'},hostCapabilities:{}};setTimeout(()=>e.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{invitationId,chatBinding:'a'.repeat(64)}}},'*'),20);}
 if(m.method==='ui/request-display-mode'&&params.has('deny'))result={mode:'inline'};
 else if(m.method==='ui/request-display-mode'){let side=document.getElementById('sidebar');if(!side){side=document.createElement('iframe');side.id='sidebar';side.title='LearningHarness sidebar';side.style='border:0;border-left:1px solid #555;width:50%;height:100vh';app.style.width='50%';side.src='/app?invitation'+(claude?'&claude':'');document.getElementById('shell').append(side);}result={};}
 if(m.method==='tools/call'){const {name,arguments:a={}}=m.params;let value={};if(name==='read_prepared_invitation')value={title:lesson.title,inlineEligible:!params.has('heavy'),resumeLesson:fullscreen};
 if(name==='native_status')value=state;
 if(name==='open_prepared_invitation'){if(!state.session.moment)state.session.moment=structuredClone(lesson);jobs.open={status:'ready',result:state};value={job:'open',...jobs.open};}
 if(name==='native_setup'){state.setup={completedAt:1};state.settings.allowInline=a.allowInline;state.learner.profile=a.profile;state.enabled=true;value=state;}
 if(name==='native_command'){const x=a.input;if(x.action==='create-confidence-quiz'){state.history.unshift({...state.session.moment,sessionID:'fixture'});state.session.moment={...lesson,id:'derived-quiz',invitationId:undefined,title:'Practice the cancellation boundary'};state.session.draft=null;}if(x.action==='set-presentation-cursor')state.session.presentationCursor=x.value;if(x.action==='save-draft')state.session.draft=x.value;if(x.action==='set-inline-questions')state.settings.allowInline=x.value;if(x.action==='disable'||x.action==='stop')state.enabled=false;if(x.action==='submit'){state.session.feedback={answer:x.value.answer,confidence:x.value.confidence,verdict:'correct',feedback:'Right. The wait should reject, preventing the next request.',next:'Both asynchronous steps need cancellation.'};state.session.draft=null;}state.revision++;jobs.command={status:'ready',result:state};value={job:'command'};}
 if(name==='native_job')value=jobs[a.job];result={structuredContent:value};}
 e.source.postMessage({jsonrpc:'2.0',id:m.id,result},'*');
 });</script></body></html>`);
}).listen(Number(process.env.UI_TEST_PORT||8474),'127.0.0.1',()=>console.log('Synthetic inline host: http://127.0.0.1:8474'));
