import {homedir} from 'node:os';import {isAbsolute,join} from 'node:path';
// Pin one host and its installed runtime. Never infer a host/session from recent files.
export function desktopConfig(env=process.env,home=homedir()){
 const host=env.LH_DESKTOP_HOST??env.LEARNING_HARNESS_HOST??'codex';
 if(!['codex','claude'].includes(host))throw Error('Unsupported desktop learning host.');
 const explicit=env.LH_DESKTOP_DATA_DIR??env.LEARNING_HARNESS_DATA_DIR;
 if(host==='claude'&&!explicit)throw Error('Claude controls require an explicit installed data directory.');
 if(explicit&&!isAbsolute(explicit))throw Error('Desktop learning data directory must be absolute.');
 return {host,hostName:host==='claude'?'Claude':'Codex',bundle:host==='claude'?'com.anthropic.claudefordesktop':'com.openai.codex',dataDirectory:explicit??join(home,'.local/share/learning-harness',host)};
}
