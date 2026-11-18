// The build supplies canonical-server.mjs from the current Codex release server.
// Only identity, host metadata and resource names are adapted; learning stays shared.
import {acknowledgeAutomaticLauncher} from './launcher-control.mjs';
import {respond as canonical} from './canonical-server.mjs';
import {resolveChatBinding} from '../../adapters/claude/src/chat-binding.js';
import {chainDirectory} from './chain.mjs';
import {runtimeCall} from '../desktop-runtime/runtime-client.mjs';
import {createInterface} from 'node:readline';
export async function respond(method,p={}){
 if(method==='tools/list'){
  const listed=await canonical(method,p);
  const result={...listed,tools:[...listed.tools]};
  const base=result.tools.find(t=>t.name==='open_learn');
  result.tools.push({...base,name:'show_learning_launcher',title:'LearningHarness',description:'Show one compact reusable Open LearningHarness link after the early-launcher control. Do not expand the panel, enable learning or wait for a lesson.',annotations:{readOnlyHint:false,destructiveHint:false}});
  return {tools:result.tools.map(tool=>({...tool,inputSchema:{...tool.inputSchema,properties:{...tool.inputSchema.properties,chatBinding:{type:'string',pattern:'^[a-f0-9]{64}$',description:'Use this chat’s binding from the LearningHarness SessionStart control; never ask the user for an ID.'}}}}))};
 }
 if(method==='resources/read'){
  const result=await canonical(method,p);
  const explicit=['ui://learning-harness/claude/v1/learn','ui://learning-harness/enable/learn','ui://learning-harness/claude/v1/settings'].includes(p.uri);
  return explicit?{...result,contents:result.contents.map(item=>({...item,_meta:{...item._meta,ui:{...item._meta?.ui,preferredDisplayMode:'fullscreen'}}}))}:result;
 }
 if(method==='tools/call'){
  const id=await resolveChatBinding(chainDirectory,p.arguments?.chatBinding,p._meta);
  if(p.name==='show_learning_launcher'){
   const first=await acknowledgeAutomaticLauncher(chainDirectory,id);
   return {content:[{type:'text',text:'LearningHarness launcher.'}],structuredContent:{view:'learn',launcher:true,first,chatBinding:p.arguments.chatBinding}};
  }
  const result=await canonical(method,{...p,_meta:{session_id:id}});
  return {...result,structuredContent:{...result.structuredContent,chatBinding:p.arguments.chatBinding}};
 }
 return canonical(method,p);
}
const lease=process.env.DONTDUMB_NATIVE_TEST_NO_SERVICE?null:setInterval(()=>void runtimeCall('ping').catch(()=>{}),10000);lease?.unref();
if(lease)void runtimeCall('ping').catch(()=>{});
try{for await(const line of createInterface({input:process.stdin})){let m;try{m=JSON.parse(line);if(m.id===undefined)continue;process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:await respond(m.method,m.params)})+'\n');}catch{if(m?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'LearningHarness could not connect this view. Reopen it from the current Claude Code chat. Check that its plugin hooks are enabled.'}})+'\n');}}}finally{clearInterval(lease);}
