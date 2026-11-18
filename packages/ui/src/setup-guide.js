export function setupGuide(host) {
  if (host === 'codex') return {
    title: 'Before you start',
    steps: ['Enable LearningHarness in Plugins, then start a new Codex chat.', 'Open Settings → Hooks (or Review hooks above the composer). Review and trust LearningHarness’s readiness hook.', 'Choose your coding chat below and select Watch this chat.'],
    returnHint: 'To return later, say “open Learn” or select the Start LearningHarness skill. Hooks invite you; they never open the panel automatically.'
  };
  if (host === 'claude') return {
    title: 'Before you start',
    steps: ['Use Code in Claude.app with a local project and your Claude subscription.', 'Enable LearningHarness in the plugin manager, accept its normal hook/module review, and start a new Code session.', 'Run /dontdumb:dontdumb. Choose that connected chat below and select Watch this chat.'],
    returnHint: 'The bundled module connects through your Code session. If no chat appears, restart that session and refresh. Embedded placement depends on the host; an external browser is the fallback.'
  };
  return {
    title: 'Set up Learn',
    steps: ['Use OpenCode Desktop 2.2.5 and an already connected working model.', 'After installing LearningHarness, restart OpenCode. Run /dontdumb on in a coding chat.', 'Keep Learn beside your work. Choose a suggestion or ask about the observed work.'],
    returnHint: 'Return with /dontdumb or ⌘⇧L. OpenCode manages plugin permissions; there is no separate Codex-style hook trust step. This build targets Desktop, not the terminal UI.'
  };
}
