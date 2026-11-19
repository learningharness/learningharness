let sequence=0;const pending=new Map<number,any>();
window.addEventListener('message',e=>{if(e.source!==parent)return;const m=e.data;if(m?.jsonrpc!=='2.0')return;const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='ui/resource-teardown'&&m.id!==undefined)parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');});
export function request(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('The plugin did not respond. Reopen Learn to reconnect.'));},10000);pending.set(id,{resolve,reject,timer});parent.postMessage({jsonrpc:'2.0',id,method,params},'*');});}
export function notify(method:string,params:any={}){parent.postMessage({jsonrpc:'2.0',method,params},'*');}
export async function connect(){const initialized=await request('ui/initialize',{appInfo:{name:'LearningHarness',version:'0.0.20'},appCapabilities:document.documentElement.dataset.learningHost==='claude'&&document.documentElement.dataset.claudeLauncher==='true'?{availableDisplayModes:['fullscreen']}:{availableDisplayModes:['inline','fullscreen']},protocolVersion:'2026-01-26'});parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*');return initialized;}
export async function tool(name:string,args:any={}){const binding=document.documentElement.dataset.learningHost==='claude'?{chatBinding:await claudeChatBinding()}:{};const r=await request('tools/call',{name,arguments:{...args,...binding}});if(r.isError)throw Error('The learning action failed. Please try again.');return r.structuredContent;}

// Bind each rendered card to the result of its own launcher, never the latest
// session goal. Hosts may deliver this just after ui/initialize completes.
let invitationId:string|undefined;
const bindingWaiters=new Set<(id:string)=>void>();
function acceptBinding(value:any){if(value?.structuredContent?.suppressed||value?.result?.structuredContent?.suppressed){invitationId='suppressed';for(const fn of bindingWaiters)fn('suppressed');bindingWaiters.clear();return;}const id=value?.structuredContent?.invitationId??value?.result?.structuredContent?.invitationId;if(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)){invitationId=id;for(const fn of bindingWaiters)fn(id);bindingWaiters.clear();}}
window.addEventListener('message',e=>{if(e.source===parent&&e.data?.method==='ui/notifications/tool-result')acceptBinding(e.data.params);});
export function preparedInvitationId(){
 const host=(window as Window&{openai?:{toolOutput?:any}}).openai;
 acceptBinding({structuredContent:host?.toolOutput});
 if(invitationId==='suppressed')return Promise.reject(Error('INVITATION_ALREADY_SHOWN'));
 if(invitationId)return Promise.resolve(invitationId);
 return new Promise<string>((resolve,reject)=>{const done=(id:string)=>{clearTimeout(timer);id==='suppressed'?reject(Error('INVITATION_ALREADY_SHOWN')):resolve(id);};const timer=setTimeout(()=>{bindingWaiters.delete(done);reject(Error('This invitation cannot be restored. Open LearningHarness to choose a topic.'));},3000);bindingWaiters.add(done);});
}

// Claude lacks per-call host metadata. Each frame retains only its own launcher
// binding, never a process-global current-chat pointer or a manually pasted ID.
let chatBinding:string|undefined,bindingConflict=false;
const chatWaiters=new Set<(value:string)=>void>();
function acceptChatBinding(value:any){
 const candidate=value?.structuredContent?.chatBinding??value?.result?.structuredContent?.chatBinding;
 if(typeof candidate!=='string'||! /^[a-f0-9]{64}$/.test(candidate))return;
 if(chatBinding&&chatBinding!==candidate){bindingConflict=true;return;}
 chatBinding=candidate;for(const done of chatWaiters)done(candidate);chatWaiters.clear();
}
window.addEventListener('message',event=>{if(event.source===parent&&event.data?.method==='ui/notifications/tool-result')acceptChatBinding(event.data.params);});
function claudeChatBinding(){
 if(bindingConflict)return Promise.reject(Error("This view received conflicting chat connections. Reopen LearningHarness from the intended Claude Code chat."));
 acceptChatBinding({structuredContent:(window as Window&{openai?:{toolOutput?:any}}).openai?.toolOutput});
 if(bindingConflict)return Promise.reject(Error('Conflicting chat connection; reopen LearningHarness.'));
 if(chatBinding)return Promise.resolve(chatBinding);
 return new Promise<string>((resolve,reject)=>{const done=(value:string)=>{clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>{chatWaiters.delete(done);reject(Error('Reopen LearningHarness from this Claude Code chat. Its automatic connection is unavailable; check plugin hooks.'));},3000);chatWaiters.add(done);});
}
