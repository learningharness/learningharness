// Recover only an already generated, exact current moment. This path is local:
// showing a saved invitation must never start or repair model generation.
export function restorePreparedMoment(chain,session,{enabled,globallyStopped},now=Date.now()){
 const target=chain?.preparedTarget;
 if(chain?.status!=='stale'||target?.kind!=='moment'||!enabled||globallyStopped||session?.paused||session?.moment?.completed)return null;
 if(!target.momentId||session?.moment?.id!==target.momentId||session?.preparedLessons?.[target.id]?.moment?.id!==target.momentId)return null;
 return {...chain,status:'ready',runtimeKey:`moment:${target.momentId}`,readyAt:now};
}
