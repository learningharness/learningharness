import { createLearningTools, opportunityResponseSchema } from './learning-tools.js';
import { runToolLoop } from './tool-loop.js';
import {preparationResponseSchema} from './preparation-schema.js';

// Every teaching intent shares this registry and execution loop. Builders may
// use prompts internally; no bare-content production bypass exists here.
export async function runAgentCycle(options) {
  // An explicit format request already selects the tool. Avoid asking a model
  // to rediscover that choice and then spend another call wrapping the artifact.
  if(!options.execute && options.intent === 'ask' && options.requireInteractive && options.interactiveBrief && options.build) {
    const registry=createLearningTools(options), trace=[];
    const state={status:'running',remaining:options.maxRequests??3,trace,results:[]};
    const checkpoint=async()=>{await options.onCheckpoint?.(structuredClone(state));options.check?.();};
    const request=async(text,role)=>{options.check?.();if(state.remaining<=0)throw Error('Learning cycle request budget exhausted');state.remaining--;await checkpoint();const value=await options.request(text,role);options.check?.();return value;};
    try {
      const built=await registry.execute({tool:'build_interactive',input:{brief:options.interactiveBrief},reason:'The learner explicitly requested an interactive'}, {request,check:options.check??(()=>{})});
      trace.push({tool:'build_interactive',reason:'Explicit learner request'});
      const done=await registry.execute({tool:'answer_question',input:{answer:'Explore the visual below. Play it through, or step through at your own pace.',artifactId:built.value.artifactId},reason:'Attach the validated artifact'}, {request,check:options.check??(()=>{})});
      trace.push({tool:'answer_question',reason:'Validated artifact attached'});state.status='completed';await checkpoint();return {...done.value,trace};
    } catch(error){state.status='interrupted';await checkpoint();throw error;}
  }
  const registry=createLearningTools(options);
  // Migration seam: an explicitly injected executor uses the same learning tools
  // and validators. Production retains its compatibility loop until host proof.
  const execute = options.execute ?? runToolLoop;
  const result = await execute({ ...options, registry, compactContracts:options.preparing===true,responseSchema:options.intent==='goals'?opportunityResponseSchema(registry):options.preparing?preparationResponseSchema(registry):undefined });
  return { ...result.value, trace: result.trace };
}
