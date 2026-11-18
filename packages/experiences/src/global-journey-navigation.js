// OpenAI MCP Extensions: hostContext["openai/deepLink"].url is app-relative.
// Deliberately support only our saved-reading routes, without URL normalization.
export function globalJourneyRoute(hostContext){
 if(!hostContext||!Object.hasOwn(hostContext,'openai/deepLink'))return null;
 const url=hostContext['openai/deepLink']?.url;
 if(typeof url!=='string'||url.length>700)return {kind:'unavailable'};
 if(url==='/')return {kind:'library'};
 if(url==='/settings')return {kind:'settings'};
 if(!url.startsWith('/lessons/')||/[?#\\\u0000-\u0020]/u.test(url))return {kind:'unavailable'};
 let id;try{id=decodeURIComponent(url.slice('/lessons/'.length));}catch{return {kind:'unavailable'};}
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(id))return {kind:'unavailable'};
 return {kind:'lesson',id};
}
export function resolveGlobalJourneyRoute(state,route){
 if(route?.kind!=='lesson')return route??{kind:'library'};
 const record=state?.history?.find(item=>item.id===route.id);
 if(!record||(record.host&&state.capabilities?.host&&record.host!==state.capabilities.host))return {kind:'unavailable'};
 return {kind:'lesson',record:structuredClone(record)};
}
