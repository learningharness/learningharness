// Recording an invitation click is best effort; it must never gate navigation.
export async function openInvitation({ requestDisplay, openLearn, recordOpened }) {
  await requestDisplay();
  openLearn();
  void Promise.resolve().then(recordOpened).catch(() => {});
}

export const isExpandedInvitation = context => context?.displayMode === 'fullscreen';

export function invitationLabel(snapshot) {
  const session = snapshot?.session;
  const title = (session?.upcomingGoals ?? session?.goals)?.list?.[0]?.outcome ?? (session?.reviewOffer?.objective ? `Revisit ${session.reviewOffer.objective}` : null);
  if (typeof title !== 'string') return 'Open learning opportunity';
  return title.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 120) || 'Open learning opportunity';
}

// A display request may open a different frame. Keep the transcript entry
// compact until the host confirms expansion of this instance.
export function shouldExpandInvitation(context,{requested=false,previousMode=null,requestVersion=0,contextVersion=0}={}){
 return requestVersion===contextVersion&&context?.displayMode==='fullscreen'&&(requested||previousMode==='inline');
}

export function invitationModeAfterHostChange(currentInline,context,options={}){
 if(context?.displayMode==='inline')return true;
 return shouldExpandInvitation(context,options)?false:currentInline;
}

// Only a context notification for this frame may change its placement. A
// request result can describe another frame the host just opened.
export function inlineFrameAfterContext(previousInline,context,{source='host-context'}={}){
 if(source!=='host-context')return previousInline;
 if(context?.displayMode==='inline')return true;
 if(context?.displayMode==='fullscreen')return false;
 return previousInline;
}

// Rendering an already prepared short question is not consent to generate,
// expand a sidebar, or submit a learner response.
export function shouldAutoOpenQuickQuestion({invitation,inlineFrame,inlineEligible,allowInline,enabled,paused,globallyStopped,pendingExpansion}){
 return invitation===true&&inlineFrame===true&&inlineEligible===true&&allowInline===true&&enabled===true&&!paused&&!globallyStopped&&!pendingExpansion;
}
