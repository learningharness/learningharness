import {normalizePublicItem as normalizeItem} from '../../../packages/hosts/src/public-work.js';
// Native hooks only; never read the transcript or private thinking.
export function normalizeClaudeEvent(input) {
 if(typeof input?.sessionId!=='string'||!input.sessionId||input.sessionId.length>200||typeof input.id!=='string'||input.id.length>200)return [];
 const session=input.sessionId,id=input.id;
 if(input.kind==='task')return normalizeItem(session,'',{id,type:'userMessage',content:[{type:'text',text:input.text}]});
 if(input.kind==='reply')return normalizeItem(session,'',{id,type:'agentMessage',text:input.text});
 if(input.kind==='file')return normalizeItem(session,'',{id,type:'fileChange',status:'completed',changes:[{path:input.path,diff:input.content}]});
 if(input.kind==='command')return normalizeItem(session,'',{id,type:'commandExecution',status:input.failed?'failed':'completed',command:input.command,aggregatedOutput:input.output,exitCode:input.failed?1:0});
 if(input.kind==='read'&&typeof input.path==='string'){const content=typeof input.content==='string'?input.content.slice(0,3200):'';if(/\.env\b|credentials|secret|auth\.json/i.test(input.path)||content&&normalizeItem(session,'',{id,type:'agentMessage',text:content}).length===0)return [];return [{version:1,id:`${id}:read`,sessionId:session,type:'tool.succeeded',data:{tool:'read',path:input.path.slice(0,1000),...(content?{content}: {})}}];}
 return [];
}
