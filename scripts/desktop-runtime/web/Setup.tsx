import {InlinePreference} from '../../../packages/ui/src/InlinePreference.js';
import {DEFAULT_USAGE_LIMITS} from '../../../packages/runtime/src/default-limits.js';
import {createSignal,onMount,onCleanup,For,Show,Switch,Match} from 'solid-js';
import {LearningLogo as LearningMark} from '../../../packages/ui/src/LearningLogo.js';
const starterPrompt = `Build a small Node.js cache demo in a new, unused folder named learning-harness-playground. If that folder exists, choose a different name; leave existing project files alone.

Use plain JavaScript and Node's built-in test runner, with no dependencies or external services. Simulate a slow data source locally. Cache its results for a short time, share one pending request when callers ask for the same key together, and make sure a failed request can be tried again.

Add tests for cache hits, expiry, concurrent requests and failures. Use a controllable clock so tests don't need to wait. Run the tests and show me how to run the demo. Start with a short plan, then implement it.`;
export function Setup(props:{host:string;finish:(profile:any,limits:any,allowInline:boolean)=>Promise<void>;settings:()=>void;profile?:any;limits?:any;allowInline?:boolean}){
 const [placement,setPlacement]=createSignal(props.allowInline??true);
 const [intro,setIntro]=createSignal(true);
 let introTimer:ReturnType<typeof setTimeout>|undefined;
 const finishIntro=()=>{clearTimeout(introTimer);setIntro(false);requestAnimationFrame(()=>heading?.focus());};
 onMount(()=>{if(intro())introTimer=setTimeout(finishIntro,3000);});onCleanup(()=>clearTimeout(introTimer));
 const claude=()=>props.host==='Claude';
 const goals=['Explain the code I ship','Reason through tradeoffs','Stay sharp while I delegate'];
 const [step,setStep]=createSignal(0),[selected,setSelected]=createSignal<string[]>(props.profile?.goals?.length?props.profile.goals:[goals[0]]),[custom,setCustom]=createSignal(''),[style,setStyle]=createSignal(props.profile?.preferences||'Visual explanations, then a chance to predict or practice.'),[pending,setPending]=createSignal(false),[hooksReviewed,setHooksReviewed]=createSignal(false),[error,setError]=createSignal(''),[adjust,setAdjust]=createSignal(false),[sessionLimit,setSessionLimit]=createSignal(props.limits?.session??DEFAULT_USAGE_LIMITS.session),[totalLimit,setTotalLimit]=createSignal(props.limits?.total??DEFAULT_USAGE_LIMITS.total);
 const [copyStatus,setCopyStatus]=createSignal('');
 let pane!:HTMLDivElement,heading!:HTMLHeadingElement,promptField!:HTMLTextAreaElement;
 async function copyPrompt(){try{await navigator.clipboard.writeText(starterPrompt);setCopyStatus('Copied. Choose Start learning, then paste it into your coding chat.');}catch{promptField?.closest('details')?.setAttribute('open','');promptField?.focus();promptField?.select();setCopyStatus('Copy the selected prompt with ⌘C.');}}
 const valid=()=>step()===1?!!selected().length||!!custom().trim():step()===3?hooksReviewed():step()===4?Number.isSafeInteger(sessionLimit())&&sessionLimit()>0&&Number.isSafeInteger(totalLimit())&&totalLimit()>0:true;
 const move=(next:number)=>{setStep(next);setError('');pane?.scrollTo(0,0);requestAnimationFrame(()=>heading?.focus());};
 async function proceed(){if(step()<4){move(step()+1);return;}setPending(true);setError('');try{await props.finish({goals:[...new Set([...selected(),...(custom().trim()?[custom().trim()]:[])])],known:props.profile?.known??[],preferences:style()},{session:sessionLimit(),total:totalLimit()},placement());}catch(e:any){setError(e.message);}finally{setPending(false);}}
 return <Show when={!intro()} fallback={<main class="lh-brand-intro" aria-label="Welcome to LearningHarness"><div><LearningMark/><h1>LearningHarness</h1><p>Your agent writes.<br/>You stay sharp.</p></div><button class="dd-link lh-intro-next" onClick={finishIntro}>Next <span aria-hidden="true">→</span></button></main>}><main class="lh-setup lh-tour lh-tour-compact">
  <header class="lh-setup-header"><span class="lh-wordmark"><LearningMark/>LearningHarness</span><button class="dd-icon" onClick={props.settings} aria-label="Open settings">⋯</button></header>
  <div class="lh-tour-progress" aria-label={`Setup step ${step()+1} of 5`}><For each={[0,1,2,3,4]}>{n=><span classList={{complete:n<=step()}}/>}</For><small>{step()+1} / 5</small></div>
  <div class="lh-tour-body" classList={{'lh-placement-step':step()===2}} ref={pane}>
   <Switch>
    <Match when={step()===0}>
     <span class="lh-eyebrow">BUILD WITH {props.host.toUpperCase()}</span><h1 ref={heading} tabIndex={-1}>Understand what<br/><em>your agent writes.</em></h1>
     <p class="lh-tour-lead">Own your AI-written code. Understand its decisions, trace its behavior, and keep practising your judgment.</p>
     <div class="lh-tour-pair" aria-label="Your agent builds while you learn"><div><small>YOUR AGENT</small><strong>Builds and tests</strong><span>Code. Decisions. Progress.</span></div><div><small>YOU</small><strong>Explain and change it</strong><span>Trace decisions. Predict failures.</span></div></div>
     <p class="lh-tour-risk-line"><span class="lh-tour-risk">Keep your engineering judgment.</span> Practise on the code you ship.</p>
     <div class="lh-tour-invest"><strong>Your {props.host} connection. Your allowance.</strong><p>No extra API key or LearningHarness model backend.</p><Show when={claude()}><p>Requires Claude Code CLI, signed in with an active Claude subscription. <code>claude auth login</code></p></Show></div>
     <a class="lh-tour-research" href="https://www.anthropic.com/research/AI-assistance-coding-skills" target="_blank" rel="noopener noreferrer">Research from Anthropic: why practice matters ↗</a>
    </Match>
    <Match when={step()===1}>
     <span class="lh-eyebrow">A COMPANION BESIDE YOUR WORK</span><h1 ref={heading} tabIndex={-1}>Know why<br/><em>the code works.</em></h1>
     <section class="lh-setup-section"><h2>Pick your focus</h2><div class="lh-goal-options"><For each={goals}>{item=><button aria-pressed={selected().includes(item)} classList={{selected:selected().includes(item)}} onClick={()=>setSelected(current=>current.includes(item)?current.filter(value=>value!==item):[...current,item])}><span class="lh-option-marker" aria-hidden="true">{selected().includes(item)?'✓':'□'}</span>{item}</button>}</For></div><input class="lh-custom-goal" aria-label="A specific learning goal" placeholder="Or name something you want to understand…" value={custom()} onInput={e=>setCustom(e.currentTarget.value)} maxLength={200}/></section>
     <details class="lh-tour-detail"><summary>Learning style</summary><div class="lh-style-options" role="group" aria-label="Learning style"><For each={[
      {label:'Visual first',value:'Visual explanations, then a chance to predict or practice.'},
      {label:'Let me predict',value:'Ask me to predict decisions, then explain the tradeoffs.'},
      {label:'Walk me through',value:'Concise explanations of the system and its tradeoffs.'}
     ]}>{item=><button aria-pressed={style()===item.value} onClick={()=>setStyle(item.value)}>{item.label}</button>}</For></div><small>Change your focus and style later in Settings.</small></details>
    </Match>
    <Match when={step()===2}>
     <span class="lh-eyebrow">YOUR SPACE TO LEARN</span><h1 ref={heading} tabIndex={-1}>Keep it<br/><em>close to the work.</em></h1>
     <InlinePreference value={placement()} onChange={setPlacement}/>
    </Match>
    <Match when={step()===3}>
     <span class="lh-eyebrow">{claude()?'HOW LEARNING CONNECTS':'ONE PERMISSION TO REVIEW'}</span><h1 ref={heading} tabIndex={-1}>Learning follows<br/><em>the work.</em></h1>
     <figure class="lh-tour-system" aria-label="A local hook signals activity; LearningHarness builds learning with your host model"><div><span>CODING CHAT</span><strong>Work happens</strong></div><b aria-hidden="true">→</b><div><span>LOCAL HOOK</span><strong>Signals activity</strong></div><b aria-hidden="true">→</b><div><LearningMark/><strong>Learn moments</strong></div><figcaption>LearningHarness reads selected activity separately and uses your existing {props.host} model and learning tools.</figcaption></figure>
     <div class="lh-tour-highlight"><Show when={claude()} fallback={<><strong>In {props.host}: Review hooks</strong><p>Choose <b>Review hooks</b> above the composer, or <b>Settings → Hooks</b>. Trust LearningHarness, then return here.</p></>}><strong>Uses the Claude Code plugin</strong><p>The installed plugin uses background activity hooks to identify this chat and signal work. There is no separate hook approval step required by this tour. After installing or updating, restart Claude and start a fresh Code chat.</p></Show></div>
     <label class="lh-tour-check"><input type="checkbox" checked={hooksReviewed()} onChange={e=>setHooksReviewed(e.currentTarget.checked)}/><Show when={claude()} fallback={<>I reviewed and trusted the hooks in {props.host}.</>}>I understand how LearningHarness uses activity from this Code chat when learning is On.</Show></label>
     <small><Show when={claude()} fallback={<>This confirms your review. It doesn’t approve permissions for you.</>}>This records your understanding. It does not verify the plugin connection or change Claude permissions.</Show></small>
     <details class="lh-tour-detail"><summary>What am I allowing?</summary><p>Hooks identify the chat and signal activity. The learning runtime reads selected chat activity, tool results and changes; it doesn’t edit your project. Relevant context reaches your existing {props.host} model. No LearningHarness inference backend receives it.</p><p><Show when={claude()} fallback={<>Without hook trust, automatic observation and invitations won’t run.</>}>Automatic observation needs the plugin’s activity connection. If it is unavailable, report the connection issue; this checkbox cannot enable or repair it.</Show></p></details>
    </Match>
    <Match when={step()===4}>
     <span class="lh-eyebrow">YOUR FIRST LEARNING MOMENT</span><h1 ref={heading} tabIndex={-1}>Try it on<br/><em>something real.</em></h1>
     <section class="lh-tour-starter"><span class="lh-eyebrow">LOCAL · NODE.JS · NO DEPENDENCIES</span><h2>Build a tiny cache</h2><p>Watch a real coding task turn into something worth understanding.</p><button class="dd-primary" onClick={()=>void copyPrompt()}>Copy task prompt</button><p class="lh-tour-note" role="status" aria-live="polite">{copyStatus()}</p><details class="lh-tour-detail"><summary>View the task prompt</summary><textarea ref={promptField} aria-label="Starter task prompt" readOnly>{starterPrompt}</textarea></details></section>
     <ol class="lh-tour-quickstart"><li>Copy the task.</li><li>Choose <b>Start learning</b>.</li><li>Paste it into your <b>{props.host} coding chat</b>.</li></ol>
     <p class="lh-tour-note">Invitations appear as relevant learning becomes ready. For a fresh moment, use Learn’s <b>⋯ → New learning moment</b>.</p>
     <div class="lh-tour-privacy"><p>Extra {props.host} allowance. Memory stays on this device.</p><small>PostHog usage metadata sharing starts On. Code, prompts and answers are excluded. Change it in Settings; existing opt-outs stay respected.</small></div>
     <details class="lh-tour-detail"><summary>Usage alerts &amp; controls</summary><p>{sessionLimit().toLocaleString()} tokens per chat · {totalLimit().toLocaleString()} overall. Alerts, not hard spending caps.</p><button class="dd-link" onClick={()=>setAdjust(!adjust())}>{adjust()?'Keep these values':'Adjust alerts'}</button><Show when={adjust()}><div class="lh-tour-inputs"><label>Per chat<input aria-label="Session usage alert" type="number" min="1" value={sessionLimit()} onInput={e=>setSessionLimit(Number(e.currentTarget.value))}/></label><label>Overall<input aria-label="Overall usage alert" type="number" min="1" value={totalLimit()} onInput={e=>setTotalLimit(Number(e.currentTarget.value))}/></label></div></Show><p>Learning stays On across chats and restarts. Use Off to stop it. Revisit this tour in Settings → Review setup and hook permissions.</p></details>
    </Match>
   </Switch>
   <Show when={error()}><p class="lh-inline-error" role="alert">{error()}</p></Show>
  </div>
  <footer class="lh-tour-footer"><Show when={step()>0} fallback={<span class="lh-tour-note">Your work. Your pace.</span>}><button class="dd-link" disabled={pending()} onClick={()=>move(step()-1)}>← Back</button></Show><button class="dd-link lh-tour-next-button" disabled={pending()||!valid()} onClick={()=>void proceed()}>{pending()?'Setting up…':step()===4?'Start learning':'Next'} <span aria-hidden="true">→</span></button></footer>
 </main></Show>;
}
