# Inline learning

Introduced on `codex/inline-learning`. Distribution uses the checked-main early-access release pipeline; see ../RELEASES.md.

## Experience

Setup has an “Allow quick questions inline” checkbox, enabled by default, with a wireframe preview. The same checkbox is in Settings → Preferences. It is permission for occasional short questions, not a choice between two application modes. Existing Sidebar preferences migrate to unchecked. This does not enable learning or change hook consent.

An invitation still requires a click. Only a bounded prediction or multiple-choice question can open inline: at most four short options, a short prompt and optional short context. The dedicated card contains answer controls, confidence, brief feedback and Open in sidebar. It never mounts the companion toolbar, settings, usage notices, visuals, learning tools, conversation composer or history. Full lessons and visual experiences request the sidebar. Expansion saves pending answers first; it does not generate new teaching.

The sidebar includes a read-only stack of earlier opened learning from the current session, with saved answers and feedback. Other sessions remain in Journey. Existing history retention and prepared-content bounds still apply. Reading old content creates no assessment evidence.

## State and safety

Both views use the same runtime session, moment IDs, draft and assessment commands. A presentation cursor records the invitation and exact current moment when expanding; a separately mounted expanded frame resumes that moment rather than reopening the invitation's original lesson. The runtime rejects a cursor for an unknown prepared invitation or a different current moment.

Inline refreshes retain the card's content when another view moves to a different moment. Its learning actions are blocked and the learner can open the sidebar. Existing expected-moment guards also reject races before an assessment can reach the model. Learning Off remains available even when saving a draft fails.

Returning to a prepared question restores local draft/feedback for questions outside a journey as well as existing journey progress. Repeated archiving updates that moment's record rather than losing later feedback or duplicating its history entry.

## Host contract

[The MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) defines inline/fullscreen display modes, host-context notifications and app-only tool calls. LearningHarness advertises both modes for lesson invitations. Claude's separate launcher remains fullscreen-only. The host owns placement and may deny expansion; the app must preserve the answer and show a request failure. Codex's existing expanded presentation and Claude's actual native placement require acceptance in their respective applications. A synthetic host is not evidence that either native application honored placement.

## Checks and remaining acceptance

Automated checks cover default/persisted placement in both hosts, invalid settings, preserved answers across prepared cards, stale submissions, presentation-cursor ownership, display capabilities, shared UI typing and both packages.

For browser checks, run `npm run build` then `node scripts/desktop-runtime/inline-test-harness.mjs`. Open `http://127.0.0.1:8474/`; add `?claude`, `?sidebar`, or `?onboarding`. This isolated fixture uses no model calls, hooks or learner files. Check keyboard checkbox selection, 320px panels, an immediate answer-to-sidebar transition, feedback synchronization and the session stack. It intentionally simulates the host protocol, not model quality.

Remaining native acceptance: observe both real hosts through onboarding, prediction, a complete quiz, expansion, app restart, a second invitation and Off. Check denied expansion and multiple open views. This branch has no new live learning evaluation and is not a completed learning-behavior milestone. Existing failed evaluation evidence in [Status](../STATUS.md) remains applicable.

Local verification on November 19, 2026: 500 core tests, 90 desktop/package tests, 3 Claude package tests and 3 display-capability tests passed; type checking and UI builds passed. An initial restricted run had seven local-socket permission failures; the permitted rerun passed. Browser checks covered both synthetic host identities, default placement, choosing Sidebar during setup, native-radio ArrowRight navigation, 320px width, in-place prediction, immediate draft flush before expansion, expanding a newly requested quiz instead of its original invitation, shared feedback, session history, stale cards and denied expansion without answer loss. No console warnings/errors were observed in those browser checks. Real host acceptance and live learning evaluation remain pending.

Native local check follow-up: built distinct beta64 and beta65 candidates without overwriting existing package versions. Found and corrected a missing native transport allowlist entry for placement and presentation-cursor commands; the browser fixture had accepted these commands without that boundary. Added a transport-policy regression test. Installed beta65 in both local hosts and verified installed UI/server/runtime bytes against the candidates. Claude Code's actual onboarding reached the placement screen with Inline selected and completed setup. Full inline interaction and Codex acceptance are still in progress; installation is not acceptance.

The actual Claude session also exposed a stale invitation after a prose UI-control turn. Added a local-only recovery for the exact current, already prepared moment. It refuses a different moment, an unprepared target, a completed moment, goals, paused sessions and Off. Publishing checks this local target before reading the refreshed chain; it does not invoke generation. A regression test covers those boundaries. Beta66 packages are the local native test candidates. Desktop/package checks now pass92/92, Claude package3/3 and type checking passes; the real cache task passes5/5. Full native interaction remains under test.

November 19 correction: replaced mutually exclusive placement controls and the full inline companion with the opt-in checkbox and dedicated bounded quick-question card. All 501 core and 92 desktop tests pass. Type checking and the UI build pass. Synthetic browser checks observed the checkbox, compact prediction, answer/confidence preservation in a separately mounted sidebar and automatic sidebar routing for a visual lesson. These checks do not establish native host acceptance or learning outcomes.

Release scope: the maintainer requested publication through the checked-main beta pipeline. Automated and isolated browser coverage supports early-access distribution, not a claim of full native acceptance or a completed learning-behavior milestone. The corrected compact card has not completed a full native Codex walkthrough.

Native follow-up: the maintainer clarified that the full app was only in the separate sidebar, which is expected. Observed loading took10–15seconds before that sidebar appeared. Backend read-only status took4–5ms. The opening path now records bounded-question eligibility with the prepared invitation, requests the sidebar before opening a full lesson, returns locally ready jobs in the first response (with durable fallback for queued work), and reuses that snapshot instead of another status request. Five new tests cover placement, immediate/queued/error paths. Native timing of this correction remains to be verified; preview timing is not native acceptance.

Exclusive presentation correction: native beta68 still showed the full app in chat and took about10seconds. Treat that report as a failed native check. A request-display-mode success may refer to a separate frame, so its result no longer promotes the original frame to the full app. Successful expansion collapses the original question to a sidebar link; a later inline-context update must not reopen the question alongside it. Only a real context notification changes same-frame placement. Non-invitation resources are also restrained when hosted inline. Every package now advertises per-host/per-version UI resource IDs and embeds its package version in the HTML; legacy resource reads resolve to the current UI without dropping saved content. Preview tests cover separate-frame fullscreen replies, later context updates, same-frame moves, answer preservation and refused expansion. Native beta69 verification remains required before merge.
