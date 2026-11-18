const clean=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,180);
export function pendingNudge(state,{visible=false,now=Date.now(),host='codex'}={}){
 const s=state?.session,review=s?.reviewOffer&&(!s.moment||s.moment.completed)?s.reviewOffer:null,goals=review??s?.upcomingGoals??(!s?.moment?s?.goals:null),goal=review?{outcome:`Review: ${review.objective}`}:goals?.list?.[0];
 if((s?.nudgeSuppressedUntil??0)>now||visible||!state?.enabled||state.globallyStopped||(!review&&state.fault)||s?.paused||!goal||s.seenOpportunityIds?.includes(goals.id)||(!review&&goals.workRevision!==s.workRevision))return null;
 const createdAt=typeof goals.createdAt==='number'?goals.createdAt:Date.parse(goals.createdAt);
 if(!Number.isFinite(createdAt))return null;
 const expiresAt=createdAt+120000;
 if(expiresAt<=now)return null;
 return {id:goals.id,sessionId:s.id,expiresAt,message:`LearningHarness · ${clean(goal.outcome)}. ${host==='claude'?'Use /dontdumb:dontdumb to open Learn.':'Use the LearningHarness skill to explore beside this chat.'}`};
}
