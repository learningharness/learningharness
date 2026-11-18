// Claude-only discovery shortcut. Runs the real user-facing command; never
// submits a prose prompt, opens a native renderer, or enables learning.
let running=false,status='off',statusSession=null,timer=null;
async function refresh($){
 try{
  const id=await $.session.id();
  const explicit=await $.env.get('LEARNING_HARNESS_DATA_DIR');
  const directory=explicit??(await $.env.get('HOME'))+'/.local/share/learning-harness/claude-candidate';
  if(typeof directory!=='string'||!directory.startsWith('/')||!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw Error('Unavailable chat status');
  const mode=JSON.parse(await $.fs.read(directory+'/state.json'));
  let next='off';
  if(mode.on){next='on';try{const chain=JSON.parse(await $.fs.read(directory+'/chain-'+id+'.json'));if(chain.status==='ready'&&chain.preparedTarget)next='ready';}catch{}}

  if(status!==next||statusSession!==id){status=next;statusSession=id;$.ui.invalidate('ui.render');}
 }catch{if(status!=='unavailable'){status='unavailable';$.ui.invalidate('ui.render');}}
}
async function open($){
 if(running)return;running=true;$.ui.invalidate('ui.render');
 try{await $.command.run({command:'learningharness:learn'});}
 catch{$.ui.toast('Use /learningharness:learn to open Learn.');}
 finally{running=false;$.ui.invalidate('ui.render');}
}
async function startStatus($,desktop=false){
 if(timer||!desktop&&!(await $.session.surfaces()).includes('desktop'))return;
 void refresh($);timer=$.clock.every(5000,async()=>refresh($));
}
export function register(on){
 on('session.start',async($,e,next)=>{await startStatus($);return next(e);});
 on('session.attach',async($,e,next)=>{const result=await next(e);await startStatus($);return result;});
 on('session.end',async($,e,next)=>{timer?.cancel();timer=null;status='off';statusSession=null;return next(e);});
 on('ui.render',{component:'SessionMode'},async($,e,next)=>{
  const host=await next(e);if(e.surface!=='desktop')return host;await startStatus($,true);
  const {Box,Button}=$.ui.resolve(e);
  return Box({flexDirection:'row',gap:1,children:[host,Button({key:'learningharness-open',label:running?'◫ Learn · queued':status==='ready'?'◫ Learn · ready':status==='on'?'◫ Learn · on':'◫ Learn',plain:true,onPress:()=>open($)})]});
 });
}
