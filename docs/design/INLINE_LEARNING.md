# Inline learning

Branch: `codex/inline-learning`. This is a development change, not an installable release.

## Experience

Setup has a dedicated placement screen after learning focus. Inline is the default for an unset preference. Native radio controls select Inline or Sidebar, and a wireframe shows where a question appears. The same choice remains available under Settings → Preferences. Each host runtime saves its own preference; this does not enable learning or change hook consent.

An invitation still requires a click. Inline opens the existing shared learning view in the invitation frame, including prediction, confidence, quizzes and feedback. Open in sidebar saves pending answers before requesting the host's expanded view. Sidebar preference keeps the existing invitation-to-expanded-view flow. No teaching is generated merely to switch placement.

The sidebar includes a read-only stack of earlier opened learning from the current session, with saved answers and feedback. Other sessions remain in Journey. Existing history retention and prepared-content bounds still apply. Reading old content creates no assessment evidence.

## State and safety

Both views use the same runtime session, moment IDs, draft and assessment commands. A presentation cursor records the invitation and exact current moment when expanding; a separately mounted expanded frame resumes that moment rather than reopening the invitation's original lesson. The runtime rejects a cursor for an unknown prepared invitation or a different current moment.

Inline refreshes retain the card's content when another view moves to a different moment. Its learning actions are blocked and the learner can open the sidebar. Existing expected-moment guards also reject races before an assessment can reach the model. Learning Off remains available even when saving a draft fails.

Returning to a prepared question restores local draft/feedback for questions outside a journey as well as existing journey progress. Repeated archiving updates that moment's record rather than losing later feedback or duplicating its history entry.

## Host contract

[The MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) defines inline/fullscreen display modes, host-context notifications and app-only tool calls. LearningHarness advertises both modes for lesson invitations. Claude's separate launcher remains fullscreen-only. The host owns placement and may deny expansion; the app must preserve the answer and show a request failure. Codex's existing expanded presentation and Claude's actual native placement require acceptance in their respective applications. A synthetic host is not evidence that either native application honored placement.

## Checks and remaining acceptance

Automated checks cover default/persisted placement in both hosts, invalid settings, preserved answers across prepared cards, stale submissions, presentation-cursor ownership, display capabilities, shared UI typing and both packages.

For browser checks, run `npm run build` then `node scripts/desktop-runtime/inline-test-harness.mjs`. Open `http://127.0.0.1:8474/`; add `?claude`, `?sidebar`, or `?onboarding`. This isolated fixture uses no model calls, hooks or learner files. Check keyboard radio selection, 320px panels, an immediate answer-to-sidebar transition, feedback synchronization and the session stack. It intentionally simulates the host protocol, not model quality.

Before release: observe both real native hosts through onboarding, prediction, a complete quiz, expansion, app restart, a second invitation and Off. Check denied expansion and multiple open views. This branch has no new live learning evaluation and is not a completed learning-behavior milestone. Existing failed evaluation evidence in [Status](../STATUS.md) remains applicable.

Local verification on November 19, 2026: 500 core tests, 90 desktop/package tests, 3 Claude package tests and 3 display-capability tests passed; type checking and UI builds passed. An initial restricted run had seven local-socket permission failures; the permitted rerun passed. Browser checks covered both synthetic host identities, default placement, choosing Sidebar during setup, native-radio ArrowRight navigation, 320px width, in-place prediction, immediate draft flush before expansion, expanding a newly requested quiz instead of its original invitation, shared feedback, session history, stale cards and denied expansion without answer loss. No console warnings/errors were observed in those browser checks. Real host acceptance and live learning evaluation remain pending.
