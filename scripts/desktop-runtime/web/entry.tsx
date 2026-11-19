import {quickQuestion} from '../../../packages/experiences/src/inline-question.js';
import {InlineQuestion} from '../../../packages/ui/src/InlineQuestion.js';
import {globalJourneyRoute} from '../../../packages/experiences/src/global-journey-navigation.js';
import {GlobalLearningJourney} from '../../../packages/ui/src/GlobalLearningJourney';
import {StartupInvitation} from './StartupInvitation';
import {Setup} from './Setup';
import {invitationLabel,shouldExpandInvitation,invitationModeAfterHostChange} from './invitation-navigation.js';
import {render} from 'solid-js/web';import {createSignal,createEffect,onMount,onCleanup,Show} from 'solid-js';
import {LearnView} from '../../../packages/ui/src/LearnView';import {connect,tool,request,notify,preparedInvitationId} from './bridge';
import '../../../packages/ui/src/styles.css';import './style.css';
function App(){const globalJourney=document.documentElement.dataset.globalJourney==='true';const [journeyStatus,setJourneyStatus]=createSignal<any>();const [journeyNavigation,setJourneyNavigation]=createSignal<any>();const invitationResource=document.documentElement.dataset.invitation==='true';const [connected,setConnected]=createSignal(false),[invitation,setInvitation]=createSignal(document.documentElement.dataset.invitation==='true'),[error,setError]=createSignal(''),[connectionNotice,setConnectionNotice]=createSignal(''),[setupDone,setSetupDone]=createSignal<boolean|null>(null),[showSettings,setShowSettings]=createSignal(false),[hostLabel,setHostLabel]=createSignal('Codex');let latestStatus:any;let timer:any,statusPending=false,surfaceInView=true;let surfaceObserver:IntersectionObserver|undefined;const listeners=new Set<any>();let revision=-1,allowanceRevision:number|null=null;
 const [inlineFrame,setInlineFrame]=createSignal(invitationResource),[allowInline,setAllowInline]=createSignal(true);
 const [hiddenInvitation,setHiddenInvitation]=createSignal(false);
 const [invitationText,setInvitationText]=createSignal('Open learning opportunity');
 let savedInvitationId:string|undefined;
 const [lessonOpening,setLessonOpening]=createSignal(false),[lessonFailed,setLessonFailed]=createSignal(false);
 let opening:Promise<void>|null=null,pendingExpansion=false,expansionRequested=false,hostMode:string|null=null,displayVersion=0;
 async function requestExpansion(){
  const requestVersion=displayVersion;expansionRequested=true;
  const display=await request('ui/request-display-mode',{mode:'fullscreen'});
  if((display?.mode??display?.displayMode)==='inline')throw Error('The host kept this view inline. Your answer is saved; try Open in sidebar again.');
  if(shouldExpandInvitation(display,{requested:true,requestVersion,contextVersion:displayVersion})){setInlineFrame(false);setInvitation(false);}
 }
 function startLesson(expanded=false,resumeCurrent=false){
  if(expanded)setInvitation(false);
  if(opening){if(!expanded)return requestExpansion().catch((e:any)=>setError(e.message));return opening;}
  if(!savedInvitationId){pendingExpansion=expanded;return Promise.resolve();}
  setLessonOpening(true);setLessonFailed(false);setError('');
  opening=(async()=>{try{
   // Request placement during the click, before awaiting any local tool call.
   if(!expanded&&!allowInline())await requestExpansion();
   else setInvitation(false);
   if(resumeCurrent){await status();return;}
   const job=await tool('open_prepared_invitation',{invitationId:savedInvitationId});
   if(!job?.job)throw Error('The lesson could not start. Please retry.');
   const deadline=Date.now()+330000;let ready=false;
   while(Date.now()<deadline){const r=await tool('native_job',{job:job.job,scope});if(r.status==='error')throw Error(r.error);if(r.status==='ready'){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,600));}
   if(!ready)throw Error('The lesson is taking longer than expected. Please retry.');
   await status();if(!expanded&&inlineFrame()&&allowInline()&&!quickQuestion(latestStatus?.session?.moment))await requestExpansion();void tool('record_chain_opened').catch(()=>{});
  }catch(e:any){setError(e.message);setLessonFailed(true);opening=null;}finally{setLessonOpening(false);}})();
  return opening;
 }
 let receivedGlobalNavigation=false;
 function receiveGlobalDeepLink(context:any,initial=false){
  if(!globalJourney||(initial&&receivedGlobalNavigation))return;
  const route=globalJourneyRoute(context);if(!route)return;receivedGlobalNavigation=true;
  setShowSettings(route.kind==='settings');
  setJourneyNavigation(route.kind==='settings'?undefined:{route});
 }
 const displayChanged=(event:MessageEvent)=>{
  if(event.source!==parent||event.data?.method!=='ui/notifications/host-context-changed')return;
  const context=event.data.params;
  receiveGlobalDeepLink(context);
  if(!invitationResource)return;
  const inline=invitationModeAfterHostChange(invitation(),context,{requested:expansionRequested,previousMode:hostMode});
  if(context?.displayMode==='inline'){displayVersion++;expansionRequested=false;pendingExpansion=false;}
  if(context?.displayMode){hostMode=context.displayMode;setInlineFrame(hostMode==='inline');}
  setInvitation(inline&&!(opening&&allowInline()));
  if(!inline)void startLesson(true);
 };
 window.addEventListener('message',displayChanged);
 const [reviewSetup,setReviewSetup]=createSignal(false),[setupProfile,setSetupProfile]=createSignal<any>(),[setupLimits,setSetupLimits]=createSignal<any>();
 const scope=globalJourney||document.documentElement.dataset.globalSettings==='true'?'global':'chat';
 let invitationCard!:HTMLElement;
 createEffect(()=>{
  const inline=inlineFrame();
  document.documentElement.toggleAttribute('data-inline-invitation',inline);
  if(!inline||!connected())return;
  const content=document.getElementById('root');if(!content)return;
  let frame=0,lastSize='';
  const report=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const height=Math.ceil(content.getBoundingClientRect().height),width=Math.ceil(document.documentElement.clientWidth);
   const size=`${width}:${height}`;
   if(width>0&&height>=0&&size!==lastSize){
    lastSize=size;notify('ui/notifications/size-changed',{width,height});
    // Some ChatGPT hosts expose the intrinsic-height compatibility channel.
    const host=(window as Window&{openai?:{notifyIntrinsicHeight?:(height:number)=>void}}).openai;
    try{host?.notifyIntrinsicHeight?.(height);}catch{/* Standard sizing remains available. */}
   }
  });};
  const observer=new ResizeObserver(report);observer.observe(content);report();
  onCleanup(()=>{observer.disconnect();cancelAnimationFrame(frame);});
 });

 async function status(){const s=await tool('native_status',{scope,input:{surfaceVisible:document.visibilityState==='visible'&&(!invitationResource||!invitation())}});if(!savedInvitationId)setInvitationText(invitationLabel(s));setAllowInline(s.settings?.allowInline!==false);setSetupDone(!!s.setup?.completedAt);setSetupProfile(s.learner?.profile);setSetupLimits(s.limits);setHostLabel(s.capabilities?.host==='claude'?'Claude':'Codex');setConnectionNotice(s.hostConnection?.model?.connected===false?'Claude Code CLI is not signed in. Sign in through Claude’s normal CLI login with an active subscription; Desktop sign-in alone may not cover it. Settings and memory remain available.':'');latestStatus=s;setJourneyStatus(s);return s;}
 const rpc={status:()=>latestStatus?Promise.resolve(latestStatus):status(),command:async(input:any)=>{const j=await tool('native_command',{input,scope});const deadline=Date.now()+330000;while(Date.now()<deadline){const r=await tool('native_job',{job:j.job,scope});if(r.status==='ready'){latestStatus=r.result;setJourneyStatus(r.result);return r.result;}if(r.status==='error')throw Error(r.error);await new Promise(r=>setTimeout(r,600));}throw Error('Learning request took too long. Please try again.');},events:{on:(_:any,fn:any)=>{listeners.add(fn);return()=>listeners.delete(fn);}}};
 // Session identity is supplied by the host on every call, never by a picker or heuristic.
 const session={id:'native-host-current',server:{client:{rpc:()=>rpc}}};
 // Strip the presentation-only placeholder; server resolves the real identity.
 const original=rpc.command;rpc.command=(input:any)=>original({...input,sessionID:undefined});
 // The native host owns its tab. Do not offer a fake content-only close.
 const ctx={id:'learning-harness',layout:{}};
 onMount(async()=>{try{const root=document.getElementById('root');if(root){surfaceObserver=new IntersectionObserver(entries=>{surfaceInView=entries[0]?.isIntersecting??false;});surfaceObserver.observe(root);}const initialized=await connect();receiveGlobalDeepLink(initialized?.hostContext,true);hostMode=initialized?.hostContext?.displayMode??null;setInlineFrame(invitationResource&&hostMode!=='fullscreen');if(document.documentElement.dataset.enableOpen==='true'&&document.documentElement.dataset.learningHost!=='claude'&&hostMode!=='fullscreen')await requestExpansion();if(invitation()){savedInvitationId=await preparedInvitationId();const displayMode=initialized?.hostContext?.displayMode;const saved=await tool('read_prepared_invitation',{invitationId:savedInvitationId,...(['inline','fullscreen'].includes(displayMode)?{displayMode}:{})});setInvitationText(saved.title);pendingExpansion ||= !!saved.resumeLesson;await status();}else await status();setConnected(true);if(pendingExpansion)void startLesson(true,latestStatus?.session?.presentationCursor?.invitationId===savedInvitationId&&latestStatus?.session?.presentationCursor?.momentId===latestStatus?.session?.moment?.id);timer=setInterval(()=>{if(!invitation()&&document.visibilityState==='visible'&&surfaceInView&&!statusPending){statusPending=true;void status().then(s=>{if(s.revision!==revision||(s.allowance?.observedAt??null)!==allowanceRevision){revision=s.revision;allowanceRevision=s.allowance?.observedAt??null;for(const fn of listeners)fn({data:{}});}}).catch(e=>setError(e.message)).finally(()=>{statusPending=false;});}},3000);}catch(e:any){if(e.message==='INVITATION_ALREADY_SHOWN'){setHiddenInvitation(true);setConnected(true);}else setError(e.message);}});onCleanup(()=>{clearInterval(timer);surfaceObserver?.disconnect();window.removeEventListener('message',displayChanged);});
 const expandQuestion=async(momentId?:string)=>{
  if(momentId)await rpc.command({action:'set-presentation-cursor',value:{invitationId:savedInvitationId,momentId},expectedMomentId:momentId});
  await requestExpansion();
 };
 return <Show when={connected()} fallback={<p role="status">{error()||'Connecting to LearningHarness…'}</p>}>
  <Show when={invitation()} fallback={
   <Show when={!lessonOpening()} fallback={<section class="lh-lesson-loading" role="status">Opening saved learning…</section>}>
    <Show when={!lessonFailed()} fallback={<section class="lh-lesson-loading"><p role="alert">{error()}</p><button onClick={()=>void startLesson(inlineFrame()?false:true)}>Retry</button></section>}>
     <Show when={inlineFrame()} fallback={
      <>
       <Show when={connectionNotice()}><p role="status" class="native-connection-notice">{connectionNotice()}</p></Show>
       <Show when={globalJourney} fallback={
        <Show when={setupDone()&&!reviewSetup()||showSettings()} fallback={
         <Setup allowInline={allowInline()} profile={setupProfile()} limits={setupLimits()} host={hostLabel()}
          settings={()=>setShowSettings(true)} finish={async(profile,limits,allowInline)=>{
           await tool('native_setup',{profile,limits,allowInline,scope});await status();setReviewSetup(false);
          }}/>
        }>
         <LearnView globalSettingsOnly={scope==='global'}
          onReviewSetup={()=>{setShowSettings(false);setReviewSetup(true);}}
          onBackToSetup={!setupDone()?()=>setShowSettings(false):undefined}
          initialTab={showSettings()||scope==='global'?'settings':'session'} session={session} ctx={ctx}
          diagnosticsPath="Local LearningHarness runtime"/>
        </Show>
       }>
        <Show when={showSettings()} fallback={<GlobalLearningJourney navigation={journeyNavigation()} onNavigationApplied={()=>setJourneyNavigation(undefined)} state={journeyStatus()} onSettings={()=>setShowSettings(true)}/>}>
         <div class="lh-global-settings"><button class="dd-link" onClick={()=>setShowSettings(false)}>← Learning journey</button>
          <LearnView globalSettingsOnly initialTab="settings" session={session} ctx={ctx} diagnosticsPath="Local LearningHarness runtime"/>
         </div>
        </Show>
       </Show>
      </>
     }><InlineQuestion session={session} onExpand={expandQuestion}/></Show>
    </Show>
   </Show>
  }>
   <section hidden={hiddenInvitation()} ref={invitationCard} class="lh-invitation" aria-label="LearningHarness invitation">
    <button disabled={lessonOpening()} onClick={()=>void startLesson()}>
     <svg class="lh-invitation-mark" aria-hidden="true" viewBox="0 0 120 120"><g fill="currentColor" transform="translate(10 10)"><path d="M0 0h20v80h20V60h20v40H0Z"/><path d="M40 0h60v100H80V20H60v20H40Z"/></g></svg>
     <span>{invitationText()} <span aria-hidden="true">↗</span></span>
    </button>
    <Show when={error()}><p class="lh-invitation-error" role="alert">{error()}</p></Show>
   </section>
  </Show>
 </Show>;
}
function Root(){const [startup,setStartup]=createSignal(document.documentElement.dataset.startupInvitation==='true');return <Show when={startup()} fallback={<App/>}><StartupInvitation open={()=>setStartup(false)}/></Show>;}
render(()=><Root/>,document.getElementById('root')!);
