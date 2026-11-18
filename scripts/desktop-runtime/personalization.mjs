import {learnerDirectory} from '../../packages/learning/src/user-memory.js';
import {homedir} from 'node:os';import {join} from 'node:path';
import {learnerStore} from '../../packages/learning/src/learner-store.js';
import {learnerTopics} from '../../packages/learning/src/learner-context.js';
// One canonical shared learner store across hosts, with legacy import.
export const memory=learnerStore(await learnerDirectory());
export const personalTools=['read_personalization','save_profile','export_memory','import_memory'].map(name=>({name,description:'UI-only local learner memory control. Available without starting a learning session.',inputSchema:{type:'object',properties:{value:{type:'object'}},additionalProperties:false},annotations:{readOnlyHint:['read_personalization','export_memory'].includes(name)},_meta:{ui:{visibility:['app']}}}));
export async function personalCall(name,args={}){
 if(name==='save_profile')await memory.saveProfile(args.value);
 if(name==='import_memory')await memory.import(args.value);
 if(name==='export_memory')return {content:[],structuredContent:{bundle:await memory.export()}};
 const data=await memory.read();return {content:[],structuredContent:{profile:data.profile,evidenceCount:data.evidence.length,explorationCount:data.explorations.length,topics:learnerTopics(data)}};
}
