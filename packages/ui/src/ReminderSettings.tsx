import {createEffect, createSignal, createUniqueId} from 'solid-js';

export function ReminderSettings(props:{value:any;busy:boolean;save:(action:string,value:any)=>Promise<any>}) {
 const id=createUniqueId(), help=createUniqueId();
 const [enabled,setEnabled]=createSignal(props.value?.remindersEnabled===true);
 const [limit,setLimit]=createSignal(props.value?.dailyAttentionLimit??1);
 let persistedKey='';
 createEffect(()=>{const enabled=props.value?.remindersEnabled===true,limit=props.value?.dailyAttentionLimit??1,key=`${enabled}:${limit}`;if(key!==persistedKey){persistedKey=key;setEnabled(enabled);setLimit(limit);}});
 return <form class="lh-reminder-settings" aria-label="Review reminders" onSubmit={event=>{event.preventDefault();void props.save('set-reengagement',{remindersEnabled:enabled(),dailyAttentionLimit:limit()});}}>
  <h2>Return to what matters</h2>
  <p id={help} class="lh-help">Offer one relevant review when you return to Learn. Reminders stay inside this panel and pause with learning. They cannot wake a closed app or sleeping Mac. Reviews in Journey remain available.</p>
  <label class="lh-reminder-toggle" for={id}><input id={id} name="remindersEnabled" type="checkbox" aria-describedby={help} checked={enabled()} disabled={props.busy} onChange={event=>setEnabled(event.currentTarget.checked)}/><span>Remind me when I return to Learn</span></label>
  <label class="lh-field">Daily reminder limit<select name="dailyAttentionLimit" value={limit()} disabled={props.busy} onChange={event=>setLimit(Number(event.currentTarget.value))}><option value="0">None</option><option value="1">1 per day</option><option value="2">2 per day</option><option value="3">3 per day</option></select></label>
  <p class="lh-help">Counts reminders acknowledged by the panel across chats in this installation. Resets at midnight UTC. Opening or reading is not practice.</p>
  <button type="submit" class="dd-secondary" disabled={props.busy}>Save reminders</button>
 </form>;
}
