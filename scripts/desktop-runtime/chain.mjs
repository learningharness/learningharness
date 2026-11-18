import {nativeDirectory} from '../../packages/hosts/src/user-data.js';
import {hostID} from './host-adapter.mjs';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {homedir} from 'node:os';
export const chainDirectory=await nativeDirectory({host:hostID});
export function chainFile(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Exact chat identity required');return join(chainDirectory,'chain-'+id+'.json');}
export function readChain(id){try{return JSON.parse(readFileSync(chainFile(id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function writeChain(id,value){mkdirSync(chainDirectory,{recursive:true,mode:0o700});const file=chainFile(id),temp=file+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(value),{mode:0o600});renameSync(temp,file);}
export {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
export const invitationUri='ui://dontdumb-chain/v20/invitation';
export const chainTools=[{name:'arm_chain_trial',title:'Arm closed-panel learning trial',description:'Explicitly arm one background learning opportunity for this exact chat. The opportunity is prepared independently; no lesson enters coding context.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false}},
{name:'show_ready_invitation',title:'Show prepared learning invitation',description:'Publish the lightweight invitation card after the learning-ready hook signals. Does not generate or return lesson content to the coding model.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{resourceUri:invitationUri}}},
...['read_chain_opportunity','record_chain_opened'].map(name=>({name,description:'UI-only prepared opportunity access for the exact host chat.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:name==='read_chain_opportunity'},_meta:{ui:{visibility:['app']}}}))];
