import {settingsExtensions,settingsTools,settingsCall} from './settings-entry.mjs';
import {readNavigationIcons} from './navigation-icons.mjs';
import {publishPrepared,readPrepared,presentationState} from '../desktop-runtime/prepared-invitation.mjs';
import {manualControlTools,manualControlCall} from '../desktop-runtime/manual-actions.mjs';
import {startupUri,readStartup,dismissStartup,markStartupShown,claimStartupView} from '../desktop-runtime/startup-invitation.mjs';
import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {runtimeCall} from '../desktop-runtime/runtime-client.mjs';
import {personalTools,personalCall} from '../desktop-runtime/personalization.mjs';
import {chainDirectory,readChain,writeChain,invitationUri} from './chain.mjs';
import {hostID,identityFrom,presentation} from './host-adapter.mjs';
const enableUri='ui://learning-harness/enable/learn';
const uri='ui://learning-harness/v19/learn',settingsUri='ui://learning-harness/v19/settings';
const journeyUri='ui://learning-harness/v20/journey';
const html=readFileSync(new URL('./view.html',import.meta.url),'utf8');
const icons=hostID==='codex'?readNavigationIcons(new URL('./assets/',import.meta.url)):undefined;
const app={ui:{visibility:['app']}};
const transport=['native_status','native_command','native_job','native_setup'];
const tools=[...(hostID==='codex'?settingsTools:[]),...personalTools,...manualControlTools,
 {name:'show_startup_invitation',title:'LearningHarness',description:'Display the startup invitation once after its startup control signal. Do not open Learn or enable learning automatically.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{resourceUri:startupUri}}},
 ...['read_startup_invitation','dismiss_startup_invitation','claim_startup_view'].map(name=>({name,description:'Startup invitation controls for the exact host chat.',inputSchema:{type:'object',properties:{},additionalProperties:false},_meta:app})),...transport.map(name=>({name,description:'Learning UI transport for this exact Codex chat.',inputSchema:{type:'object',properties:{input:{type:'object'},profile:{type:'object'},limits:{type:'object'},job:{type:'string'},scope:{type:'string',enum:['global','chat']}},additionalProperties:false},_meta:app})),
 ...[['open_learn',uri,'chat'],['open_global_settings',settingsUri,'global']].map(([name,resourceUri,scope])=>({name,...(icons?{icons}:{}),title:scope==='global'?'LearningHarness settings':'Open LearningHarness',description:'Open the LearningHarness side panel when the user explicitly asks to open Learn or LearningHarness. This only opens the view; it does not generate a lesson or change the coding task.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{resourceUri,visibility:scope==='chat'?['model','app']:['app']},...(hostID==='codex'&&scope==='global'?{}:presentation.entryMetadata(scope))}})),
 ...(hostID==='codex'?[{name:'open_learning_journey',icons,title:'LearningHarness',description:'Open saved learning across coding chats. Reading saved teaching is local and does not enable learning or start a model request.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{resourceUri:journeyUri,visibility:['app']},...presentation.entryMetadata('global')}}]:[]),
 {name:'show_ready_invitation',title:'Learning opportunity',description:'Show a prepared invitation after the readiness signal. Returns no lesson data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{resourceUri:invitationUri}}},
 ...['read_prepared_invitation','open_prepared_invitation'].map(name=>({name,description:'Saved learning invitation for the exact host chat.',inputSchema:{type:'object',properties:{invitationId:{type:'string'},displayMode:{type:'string',enum:['inline','fullscreen']}},required:['invitationId'],additionalProperties:false},_meta:app})),
 ...['read_chain_opportunity','record_chain_opened'].map(name=>({name,description:'Prepared learning opportunity access for this exact chat.',inputSchema:{type:'object',properties:{},additionalProperties:false},_meta:app}))];
export async function respond(method,p={}){
 if(method==='initialize')return {protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{},extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']},...(hostID==='codex'?settingsExtensions:{})}},serverInfo:{name:'learning-harness',title:'LearningHarness',version:'1.0.0-beta.63',...(icons?{icons}:{})}};
 if(method==='ping')return {};
 if(method==='tools/list')return {tools};
 if(method==='resources/list')return {resources:[...(hostID==='codex'?[{uri:journeyUri,name:'Learning Journey',mimeType:'text/html;profile=mcp-app'}]:[]),{uri,name:'Learn',mimeType:'text/html;profile=mcp-app'},{uri:settingsUri,name:'LearningHarness settings',mimeType:'text/html;profile=mcp-app'}]};
 if(method==='resources/read'){
  if(![uri,settingsUri,enableUri,invitationUri,startupUri,...(hostID==='codex'?[journeyUri]:[])].includes(p.uri))throw Error('Unknown resource');
  const attribute=p.uri===journeyUri?' data-global-journey="true"':p.uri===enableUri?' data-enable-open="true"':p.uri===startupUri?' data-startup-invitation="true"':p.uri===settingsUri?' data-global-settings="true"':p.uri===invitationUri?' data-invitation="true" data-inline-invitation':'';
  return {contents:[{uri:p.uri,mimeType:'text/html;profile=mcp-app',text:html.replace('<html','<html'+attribute),...(p.uri===invitationUri?{_meta:{'openai/ui':{preferredDisplayMode:'inline',availableDisplayModes:['inline','fullscreen']},'openai/widgetMinFrameHeight':0,'openai/widgetHeightHint':40,'openai/widgetShowCodexWidgetInline':true,'openai/widgetHideAttribution':true,'openai/widgetHideActions':true}}:p.uri===startupUri?{_meta:{ui:{prefersBorder:false}}}:{})}]};
 }
 if(method!=='tools/call'||!tools.some(t=>t.name===p.name))throw Error('Unknown learning request');
 if(hostID==='codex'&&settingsTools.some(tool=>tool.name===p.name))return settingsCall(p.name,p.arguments??{});
 if(manualControlTools.some(tool=>tool.name===p.name))return manualControlCall(p.name,identityFrom(p._meta),runtimeCall);
 if(transport.includes(p.name)){
  const args=p.arguments??{},id=args.scope==='global'?null:identityFrom(p._meta);
  if(args.scope!=='global'&&!id)throw Error('Codex has not supplied this view’s exact chat identity.');
  const result=await runtimeCall(({native_status:'status',native_command:'command',native_job:'job',native_setup:'setup'})[p.name],{...args,id});
  return {content:[],structuredContent:result};
 }
 if(personalTools.some(t=>t.name===p.name))return personalCall(p.name,p.arguments);
 if(p.name==='open_learning_journey')return {content:[],structuredContent:{view:'journey'}};
 if(['open_learn','open_global_settings'].includes(p.name))return {content:[{type:'text',text:'Open the LearningHarness view.'}],structuredContent:{view:p.name==='open_learn'?'learn':'settings'}};
 const id=identityFrom(p._meta);if(!id)throw Error('Exact host chat identity is unavailable');
 if(['show_startup_invitation','read_startup_invitation','dismiss_startup_invitation','claim_startup_view'].includes(p.name)){
  const state=readStartup(chainDirectory,id);
  if(p.name==='claim_startup_view')return {content:[],structuredContent:claimStartupView(chainDirectory,id)};
  if(p.name==='dismiss_startup_invitation')return {content:[],structuredContent:dismissStartup(chainDirectory,id)};
  if(p.name==='read_startup_invitation')return {content:[],structuredContent:state};
  if(state.on||!markStartupShown(chainDirectory,id))return {content:[],structuredContent:{suppressed:true}};
  return {content:[{type:'text',text:'LearningHarness startup invitation.'}],structuredContent:{startup:true}};
 }
 if(['read_prepared_invitation','open_prepared_invitation'].includes(p.name)){
  const saved=readPrepared(chainDirectory,id,p.arguments?.invitationId);
  if(p.name==='read_prepared_invitation'){if(!process.env.DONTDUMB_NATIVE_TEST_NO_SERVICE)void runtimeCall('delivery-receipt',{id,invitationId:saved.id,stage:'acknowledged'}).catch(()=>{});const state=presentationState(chainDirectory,id,saved.id);if(p.arguments?.displayMode==='inline')presentationState(chainDirectory,id,saved.id,{seenInline:true});return {content:[],structuredContent:{invitationId:saved.id,title:saved.title,resumeLesson:p.arguments?.displayMode==='fullscreen'&&(!!state.started||!!state.seenInline)}};}
  const job=await runtimeCall('open-invitation',{id,target:saved});presentationState(chainDirectory,id,saved.id,{started:true});return {content:[],structuredContent:job};
 }
 const chain=readChain(id);if(chain?.status!=='ready')throw Error('No prepared opportunity is ready for this chat');
 if(p.name==='show_ready_invitation'){if(chain.cardAt)return {content:[],structuredContent:{suppressed:true}};const saved=publishPrepared(chainDirectory,id,await runtimeCall('invitation-target',{id}));await runtimeCall('delivery-receipt',{id,invitationId:saved.id,stage:'attempted'});writeChain(id,{...chain,cardAt:Date.now()});return {content:[{type:'text',text:'A learning opportunity is ready.'}],structuredContent:{ready:true,invitationId:saved.id}};}
 if(p.name==='record_chain_opened'){writeChain(id,{...chain,openedAt:Date.now()});return {content:[],structuredContent:{opened:true}};}
 return {content:[],structuredContent:{runtime:true}};
}
// A live MCP connection keeps the independent service available with Learn closed.
const lease=process.env.DONTDUMB_NATIVE_TEST_NO_SERVICE?null:setInterval(()=>void runtimeCall('ping').catch(()=>{}),10000);lease?.unref();
if(lease)void runtimeCall('ping').catch(()=>{});
try{for await(const line of createInterface({input:process.stdin})){let m;try{m=JSON.parse(line);if(m.id===undefined)continue;process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:await respond(m.method,m.params)})+'\n');}catch(e){if(m?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:e.message}})+'\n');}}}finally{clearInterval(lease);}
