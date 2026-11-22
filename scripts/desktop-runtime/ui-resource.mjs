// Cache identity is part of the packaged UI contract, not learner state.
export const pluginVersion=process.env.LEARNING_HARNESS_PLUGIN_VERSION??'source-inline-exclusive';
export function uiResource(host,view,version=pluginVersion){
 if(!['codex','claude'].includes(host)||!['learn','settings','journey','invitation','startup','enable'].includes(view)||!/^[a-zA-Z0-9.-]+$/.test(version))throw Error('Invalid UI resource identity');
 return `ui://learning-harness/${host}/${version}/${view}`;
}
export function resolveUIResource(host,requested){
 const modern=typeof requested==='string'&&requested.match(/^ui:\/\/learning-harness\/(codex|claude)\/([a-zA-Z0-9.-]+)\/(learn|settings|journey|invitation|startup|enable)$/);
 if(modern)return modern[1]===host?uiResource(host,modern[3]):null;
 const legacy=host==='claude'?{'ui://learning-harness/claude/v1/learn':'learn','ui://learning-harness/claude/v1/settings':'settings','ui://learning-harness/claude/v1/invitation':'invitation'}:{'ui://learning-harness/v19/learn':'learn','ui://learning-harness/v19/settings':'settings','ui://learning-harness/v19/invitation':'invitation','ui://learning-harness/v20/journey':'journey'};
 legacy['ui://learning-harness/enable/learn']='enable';legacy['ui://learning-harness/v19/startup']='startup';
 return Object.hasOwn(legacy,requested)?uiResource(host,legacy[requested]):null;
}
