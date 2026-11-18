import {startCodex} from './rpc.js';
import {CodexLearningGateway} from './model-gateway.js';
import {CodexObserver} from './observer.js';
import {createAllowanceReader} from './allowance.js';
export async function createCodexHost({directory}) {
 const rpc=startCodex();
 try {
  await rpc.initialize();const result=await rpc.request('account/read',{refreshToken:false});
  if(result.account?.type!=='chatgpt')throw new Error('Sign in to Codex with ChatGPT. API-key billing is not used.');
  const catalog=(await rpc.request('model/list')).data;
  const getAllowance=createAllowanceReader({request:(...args)=>rpc.request(...args)});
  return {id:'codex',label:'Codex',account:result.account,catalog,getAllowance,
   gateway:new CodexLearningGateway({rpc,directory,models:catalog}),close:()=>rpc.close(),
   listThreads:async project=>(await rpc.request('thread/list',{...(project?{cwd:project}:{}),limit:project?20:100,sortKey:'updated_at',useStateDbOnly:true})).data.map(t=>({id:t.id,name:(t.name||t.preview||'Untitled chat').slice(0,100),cwd:t.cwd})),
   createObserver:options=>new CodexObserver({rpc,...options})};
 }catch(error){rpc.close();throw error;}
}
