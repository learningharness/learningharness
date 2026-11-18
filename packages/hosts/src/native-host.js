// See native-host.d.ts and docs/HOST_ADAPTERS.md for the host contract.
function identityFrom(...sources) {
  const ids = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 3) return;
    for (const [key, item] of Object.entries(value)) {
      if (/(?:thread|session|conversation)[_\/-]?id$/i.test(key) && typeof item === "string" && validSessionId(item)) ids.add(item);
      else if (item && typeof item === "object") visit(item, depth + 1);
    }
  };
  sources.forEach((s) => visit(s));
  if (ids.size > 1) throw Error("Conflicting chat identities; refusing to guess.");
  return [...ids][0] || null;
}
const validSessionId = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function assertNativeHost(host) {
  for (const method of ["getSession", "createObserver", "checkpoint", "connection", "close"]) if (typeof host?.[method] !== "function") throw Error(`Native host is missing ${method}`);
  if (!host.gateway || !host.catalog?.length || !host.capabilities || !host.presentation) throw Error("Incomplete native host capabilities");
  return host;
}
function nativeCapabilities(id, credentialReuse) {
  return {
    host: id,
    sessionIdentity: "stable",
    observation: { kinds: ["task.submitted", "assistant.ended", "tool.succeeded", "tool.failed", "file.changed"], publicReasoning: "none", replay: true },
    model: { independent: true, credentialReuse, cancellation: "best-effort", usage: "measured-or-estimated" },
    surface: { embedded: true, experiments: true, canvasArtifacts: true, mindMaps: true, sourceNavigation: false },
    persistence: { scope: "local-single-writer" }
  };
}
const invitationSignal = "LearningHarness has prepared one learning opportunity for this chat. Publish its invitation by calling the show_ready_invitation launcher tool once. This is a UI-only control: it does not generate learning or return lesson data. Continue the coding task independently; do not open or expand the panel automatically.";
function readinessOutput(event) {
  if (!["PostToolUse","UserPromptSubmit"].includes(event)) return null;
  return { hookSpecificOutput: { hookEventName: event, additionalContext: invitationSignal } };
}
export {
  assertNativeHost,
  identityFrom,
  invitationSignal,
  nativeCapabilities,
  readinessOutput,
  validSessionId
};

export function projectRuntimeInvitation(session,old,now=Date.now()){
 const taskId=session.workSelection?.task?.id??null;
 const moment=session.moment;
 // Already-invited prebuilds keep their delivery identity. New foreground
 // teaching gets its own identity, independent of a previously opened panel.
 const contentKey=!session.paused&&moment?.id&&!moment.orientation&&!moment.completed&&!moment.invitationId?`moment:${moment.id}`:null;
 if(contentKey){
  if(old?.runtimeKey===contentKey)return null;
  return {status:'ready',runtime:true,runtimeKey:contentKey,taskId,readyAt:now};
 }
 const opportunity=session.paused?null:(session.upcomingGoals??session.goals)?.list?.[0]?.outcome||session.reviewOffer?.id;
 const key=opportunity?`${taskId}:${opportunity}`:null;
 if(old?.runtime&&old.status==='ready'&&(!key||old.taskId!==taskId))return {...old,status:'stale'};
 if(key&&old?.runtimeKey!==key)return {status:'ready',runtime:true,runtimeKey:key,taskId,readyAt:now};
 return null;
}
