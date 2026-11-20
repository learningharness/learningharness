import {uiResource} from './ui-resource.mjs';
import {runLearningControl} from '../../packages/experiences/src/learning-controls.js';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
const actions={turn_learning_on:'on',turn_learning_off:'off',create_learning_moment:'new-moment'};
const descriptions={
 turn_learning_on:'When the user explicitly asks, turn learning On and resume this coding chat if paused. Idempotent: never toggles Off. Persists across chats and restarts. Opens the learning sidebar after enabling. Does not change coding work.',
 turn_learning_off:'When the user explicitly asks, turn learning Off across this host’s chats. Idempotent: never toggles On. Stops learning generation while preserving local memory and settings. Does not change coding work.',
 create_learning_moment:'Only when the user explicitly requests a new learning moment: prepare one teaching item and a related probe from this coding chat’s current work. Uses additional host allowance. Requires learning On and this chat unpaused; never enables it. Does not change coding work or open the panel.'
};
export const manualControlTools=Object.keys(actions).map(name=>({name,title:{turn_learning_on:'Turn learning on',turn_learning_off:'Turn learning off',create_learning_moment:'Create a learning moment'}[name],description:descriptions[name],inputSchema:{type:'object',properties:{},additionalProperties:false},...(name==='turn_learning_on'?{_meta:{ui:{resourceUri:uiResource(process.env.LEARNING_HARNESS_HOST??'codex','enable')}}}:{}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:name!=='create_learning_moment'}}));
export async function manualControlCall(name,id,call){
 const action=actions[name];if(!action)return undefined;
 if(!validSessionId(id))throw Error('The host must supply this coding chat’s exact identity.');
 if(action==='new-moment'){
  const status=await call('status',{id,input:{surfaceVisible:false}});
  if(!status.enabled||status.globallyStopped)throw Error('Turn learning on before creating a moment.');
  if(status.session?.paused)throw Error('This chat is paused. Turn learning on for this chat first.');
  await call('command',{id,input:{action:'new-moment'}});
  return {content:[{type:'text',text:'Preparing one learning moment from this chat. Open Learn to follow its progress.'}],structuredContent:{preparing:true}};
 }
 const command=async action=>{
  const job=await call('command',{id,input:{action}}),deadline=Date.now()+10000;
  while(Date.now()<deadline){const result=await call('job',{id,job:job.job});if(result.status==='ready')return result.result;if(result.status==='error')throw Error(result.error);await new Promise(resolve=>setTimeout(resolve,50));}
  throw Error('Could not confirm learning status. Open Learn to check.');
 };
 const result=await runLearningControl(action,command);
 if(action==='off'&&result?.enabled!==false)throw Error('Could not confirm learning is Off. Open Learn to check.');
 const on=result.enabled===true;
 // Never return the runtime snapshot or learner content to the coding agent.
 return {content:[{type:'text',text:on?'Learning is on.':'Learning is off.'}],structuredContent:{on}};
}
