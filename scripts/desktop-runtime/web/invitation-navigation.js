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
 return requestVersion===contextVersion&&(context?.displayMode??context?.mode)==='fullscreen'&&(requested||previousMode==='inline');
}

export function invitationModeAfterHostChange(currentInline,context,options={}){
 if(context?.displayMode==='inline')return true;
 return shouldExpandInvitation(context,options)?false:currentInline;
}
