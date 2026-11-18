import {connect} from 'node:net';
import {join} from 'node:path';
import {desktopConfig} from './config.mjs';
// The optional helper connects to the installed runtime; it never starts a
// second engine from a developer checkout or replaces the installed version.
export async function runtimeCall(method,params={}, {env=process.env}={}) {
 const config=desktopConfig(env),socketPath=join(config.dataDirectory,'core.sock');
 const unavailable=`Open ${config.hostName} and open Learn once to connect the local controls.`;
 return new Promise((resolve,reject)=>{
  const socket=connect(socketPath);let text='';
  const timer=setTimeout(()=>socket.destroy(Error('Learning controls timed out. Open LearningHarness once to reconnect.')),8000);
  socket.on('connect',()=>socket.end(JSON.stringify({method,params})+'\n'));
  socket.on('data',chunk=>{text+=chunk;if(text.length>131072)socket.destroy(Error('Learning controls returned an oversized response.'));});
  socket.on('end',()=>{clearTimeout(timer);try{const reply=JSON.parse(text);reply.error?reject(Error(reply.error)):resolve(reply.result);}catch{reject(Error(unavailable));}});
  socket.on('error',()=>{clearTimeout(timer);reject(Error(unavailable));});
 });
}
