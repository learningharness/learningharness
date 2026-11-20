import {randomUUID} from 'node:crypto';
import {quickQuestion} from '../../packages/experiences/src/inline-question.js';
export function preparedPlacement(session,target){
 const saved=target?.id&&Object.hasOwn(session?.preparedLessons??{},target.id)?session.preparedLessons[target.id]:null;
 return !!quickQuestion(saved?.moment);
}
// Retain a durable job for slow/queued work, but return locally ready teaching
// in the first response so opening it does not require another host round trip.
export async function openPreparedJob({id,jobs,open,afterOpen=async()=>{},onFailure=()=>{},waitMs=80}){
 const job=randomUUID();await jobs.create(job,id);
 const done=Promise.resolve().then(async()=>{
  let value;
  try{const result=await open();await afterOpen();value={status:'ready',result};}
  catch(error){value={status:'error',error:error.message};}
  try{await jobs.settle(job,value);return {job,...value};}
  catch(error){onFailure();return {job,status:'error',error:error.message};}
 });
 let timer;
 try{return await Promise.race([done,new Promise(resolve=>{timer=setTimeout(()=>resolve({job}),waitMs);})]);}
 finally{clearTimeout(timer);}
}
