export function learningShortcut(event,mac=true){
 if(event.defaultPrevented||event.repeat||event.isComposing||!event.shiftKey)return null;
 if(mac?(!event.metaKey||event.altKey):(!event.ctrlKey||event.metaKey))return null;
 if(mac?event.ctrlKey:event.altKey)return null;
 const key=event.key.toLowerCase();
 if(key==='l')return 'on';
 if(key==='o')return 'off';
 if(key==='m'){
  const target=event.target;
  if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return null;
  return 'new-moment';
 }
 return null;
}

// Shared by panel buttons/keys and explicit coding-agent tools. No toggle path.
export async function runLearningControl(action,command){
 if(action==='off')return command('disable');
 if(action==='new-moment')return command('new-moment');
 if(action!=='on')throw Error('Unknown learning control');
 let result=await command('enable');
 if(!result?.enabled||result.globallyStopped)throw Error('Learning could not be turned on. Try again.');
 if(result.session?.paused)result=await command('resume');
 if(!result?.enabled||result.session?.paused)throw Error('This chat could not resume. Try again.');
 return result;
}

export function learningModeControl(state){
 const enabled=Boolean(state?.enabled&&!state?.globallyStopped),paused=Boolean(state?.session?.paused);
 return {label:!enabled?'Off':paused?'Paused':'On',checked:enabled&&!paused,action:enabled&&!paused?'off':'on'};
}
