export function usageAlertKey(state) {
 if(!state?.limits)return null;
 const total=state.usage??{},session=state.session?.usage??{};
 const exceeded=(usage,limit)=>Number.isFinite(limit)&&limit>0&&(usage.input??0)+(usage.output??0)>=limit;
 const globalAlert=exceeded(total,state.limits.total),sessionAlert=exceeded(session,state.limits.session);
 if(!globalAlert&&!sessionAlert)return null;
 return state.session?.usageAlertDismissed ? null : JSON.stringify([state.session?.id??null]);
}
