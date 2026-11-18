// Explicit anonymous events; never send raw URLs, queries, content or identity.
export function eventProperties(href,referrer='') {
 const u=new URL(href), pick=(key,allowed)=>{const v=u.searchParams.get(key);return !v?'none':allowed.includes(v)?v:'other';};
 let origin='none';try{origin=new URL(referrer).hostname;}catch{}
 return {path:/^\/(?:docs\/[a-z-]+\/|thesis\/)?$/.test(u.pathname)?u.pathname:'other',source:pick('utm_source',['twitter','x','newsletter','github','producthunt']),medium:pick('utm_medium',['social','dm','referral']),campaign:pick('utm_campaign',['launch','early-beta']),referrer:['t.co','x.com','twitter.com','github.com','producthunt.com','www.producthunt.com','learningharness.dev'].includes(origin)?origin:origin==='none'?'none':'other'};
}
export function startAnalytics({token,host}) {
 if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl||!/^phc_[\w-]+$/.test(token)||host!=='https://us.i.posthog.com')return;
 const id=crypto.randomUUID(), base=eventProperties(location.href,document.referrer);
 const send=(event,properties={})=>fetch(host+'/i/v0/e/',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain'},body:JSON.stringify({api_key:token,distinct_id:id,event,properties:{...base,...properties,$process_person_profile:false,$geoip_disable:true,environment:location.hostname==='learningharness.dev'?'production':'test',surface:'website'}}),keepalive:true}).catch(()=>{});
 send('lh_web_pageview');
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a');let url;try{url=a?new URL(a.href,location.href):null;}catch{}
  if(url?.origin===location.origin&&/^\/downloads\/.*\.zip$/.test(url.pathname))send('lh_web_download_click',{host:url.pathname.includes('claude')?'claude':'codex'});
  else if(url?.origin===location.origin&&url.pathname==='/docs/agent-install/')send('lh_web_install_guide_click');
  else if(e.target.closest?.('[data-copy-install]'))send('lh_web_copy_prompt_click');
 });
}
