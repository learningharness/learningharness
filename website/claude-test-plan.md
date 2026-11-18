# LearningHarness for Claude Code — website end-to-end test plan

Purpose: test the released Claude candidate as a customer, beginning at
https://learningharness.dev . The current target is **the Claude version in the live installation manifest**, an
experimental release candidate. It is ready to test; native acceptance is not
assumed. This plan tests the installed product, not a replacement demo.

## Rules and result labels

- Read https://learningharness.dev/install.md and the live /install.json first.
  Select host `claude`; never install the Codex package as a substitute.
- Use macOS and Claude Desktop's **Code** tab. General Chat and Cowork are outside
  this candidate's scope. Record unsupported environments as BLOCKED.
- Preserve unrelated plugins, connectors, projects, sign-ins and learner data.
  Use a new, unused synthetic project folder. Do not modify product source or
  force internal state to make a test pass.
- Use normal approval controls. The user handles browser sign-in, hook review,
  save/quit/reopen and any disruptive account/network changes. Never extract
  credentials, approve trust silently or pipe downloaded code into a shell.
- Do not paste session IDs or use the old get-time diagnostic to bypass a failed
  connection. Automatic binding is part of the test.
- All coding-chat test requests below must be explicitly sent by the user/test
  operator. The tutor must not send new tasks or context requests automatically.
- PASS requires observed expected behavior. FAIL means observed incorrect behavior.
  BLOCKED means an unmet prerequisite prevented the test. NOT RUN means untested.
  Explain the distinction; do not convert either into PASS.
- Keep screenshots/reports local. Redact account details, credentials, source,
  private answers and memory exports before sharing a support issue.

## Record the environment

Record date, macOS version/architecture, Claude Desktop version, Claude Code CLI
version, selected learning/context/content-builder models, download URL and hash,
manifest version/channel, installed plugin version and whether other LearningHarness
versions were already installed. Account reporting should contain only sign-in
method/availability, not email addresses, tokens or other account details.

Classify the run correctly: **fresh install**, **upgrade**, or **reinstall**.
An existing candidate installation is an upgrade/reinstall. Do not delete memory
or other plugins to call it fresh. Use a genuinely separate approved test profile
or machine for a clean-install run if one is available.

## A. Website, account and installation

### T01 — Release selection and integrity

1. Open the website and the Claude guide at /docs/claude-code/.
2. Confirm the candidate label, macOS/Node requirements, pending native acceptance
   and Claude CLI subscription sign-in requirement are visible.
3. Read /install.json. Select exactly one `claude` entry; require HTTPS, the current
   expected version, package root, installer and published SHA-256.
4. Download and hash the archive. Inspect safe paths before extracting, then read
   README.md. Check the embedded plugin manifest matches the selected version.

PASS: correct host/version and exact checksum; no guessed URLs or misleading stable/
marketplace approval claim. Record URL, version and hash, not just “download worked”.

### T02 — Standard CLI authentication

The local Claude Code CLI needs a normal sign-in with an active Claude subscription.
Desktop sign-in alone may not cover it. Check status through Claude's supported
commands without exposing credentials. If sign-in is needed, notify the user and
let them run `claude auth login` and complete Claude's own browser flow.

PASS: intended CLI account can perform the later real learning request. No password,
login-token extraction, API key or silent provider/account fallback. A successful
status command alone does not prove that the subscription can generate.

### T03 — Supported installer and preservation

Run only the manifest-declared installer from the verified, unpacked bundle through
normal approved local tools. Keep the bundle together. Record its success, version
and backup location without publishing configuration contents.

PASS: its plugin and Desktop MCP connector are registered; unrelated entries and
existing data remain intact; a private Desktop config backup exists. This candidate
needs the bundled setup: marketplace-only installation is not enough.

### T04 — User restart and plugin loading

Finish/save active work. Let the user fully quit Claude with ⌘Q, reopen it, confirm
the installed plugin is enabled and start a fresh Code chat. Handle only permission
prompts Claude actually presents; no `/hooks` command or separate hook-approval
screen is required. Never quit for the
user, forge trust or report success from registration alone.

PASS: intended plugin is enabled in a fresh Code session. Verify automatic binding
in T05; absence of a hook-approval prompt is not a failure. A checkbox acknowledging
activity access does not prove hooks loaded. Report a real missing activity connection
as BLOCKED or FAIL with evidence rather than bypassing it.

## B. First-run connection and user controls

### T05 — Early launcher and automatic exact-chat binding

In a fresh Code chat, send an ordinary synthetic coding task. For the candidate
that implements this gate, an **Open LearningHarness** launcher must appear near
the start of the first turn, before any prepared lesson. Do not ask the coding
agent to open Learn as the successful test path. Click the launcher while coding
is still in progress.

PASS: the current shared learning UI opens for this exact chat, without sending a
new user message, waiting for a lesson, copying a session ID, using an old diagnostic
widget or guessing a recently active chat. The initial launcher still uses one
UI-only tool call in the first ordinary coding turn; disclose that it is not a
standalone native menu or zero-model bootstrap. Clicking the link must require no
new model call, stop/queue the coding task or enable learning by itself.

If no early launcher appears, or automatic binding fails, mark this release gate
FAIL. An explicit “Open LearningHarness” request can diagnose/recover the view but
does not turn the independent-opening gate into PASS. Published Beta 27 predates
the new launcher candidate, so record its limitation rather than pretending it
implements this gate. Native acceptance remains pending.

### T06 — Onboarding, branding and consent

Check the LearningHarness mark, readable theme, setup flow and CLI-auth disclosure.
Choose synthetic interests such as “Understand caching and request flow” and record
the chosen learning style and limits. Read the plugin activity-access explanation. Do not require a separate hook-approval prompt.

PASS: choices save; no setup/hook approval is submitted on the user's behalf;
learning turns On only through the user's chosen setup/control. Existing users may
use Settings → Review setup and hook permissions without resetting memory.

### T07 — Off before learning

While learning is Off, send a harmless synthetic coding message. Inspect status and
usage before/after, allowing any older in-flight request to settle separately.

PASS: no new work capture or tutor generation starts from that message. The ordinary
coding reply continues. Opening the UI, auth status checks and local status polling
are not model generations.

## C. Real work to proactive learning

### T08 — Coding proceeds independently

Turn learning On explicitly and send this task in the same Code chat:

> In a new, unused folder named learningharness-cache-test, build a small Node.js
> cache demo. If that name exists, use a different folder; leave existing files
> alone. Use no dependencies or external services. Simulate a data source locally.
> Support cache hits, TTL expiry, sharing one pending request for concurrent callers,
> and retry after a failed request. Include a mutation path that invalidates the
> cached value. Use a controllable clock and node:test. State a short plan, implement,
> run tests and explain how to run the demo. Do not wait for learning activities.

PASS: the coding agent completes ordinary work while the tutor runs separately.
Ignoring a learning invitation must not block, redirect or degrade coding.

### T09 — Automatic prepared invitation

Keep Learn closed while the coding task runs. Record when relevant work was observed,
when teaching becomes ready and when an actual native invitation appears. Do not
click a manual “find suggestions” action for this proactive case.

Readiness needs a later eligible hook/tool event; it is not guaranteed mid-thinking.
If the coding turn ended before preparation finished, explicitly send this one normal
follow-up to provide another tool event:

> Run the existing demo tests once and report the result. Do not change files.

Allow a bounded observation window (up to three minutes for this test, not a product
latency promise). Record timing and whether the follow-up was needed.

PASS: a real native invitation names useful content tied to the task and learner
interest, without requesting a tutoring prompt. No broad transcript dump, policing
of the coding agent or lesson text appears in the main coding context. If only manual
suggestion works, record that separately; the proactive case has not passed.

### T10 — Saved lesson, native placement and reopen

Click the prepared topic. Check the sidebar beside the coding chat and its actual
content. Record model-call counters before/after opening saved content when available.
Close the sidebar, then click the same invitation again. Repeat three times.

PASS: the exact saved topic opens; the full lesson does not spill inline on close;
each reopen works with one click; no duplicate generation is needed merely to display
prepared content. A second-click workaround is a FAIL for single-click reopening.
The host's surrounding header/controls are distinct from our learning UI.

## D. Learning tools and evidence

### T11 — Explanation and mind map

Use the learning panel to request a map of source data → cached copy → mutation →
invalidation → next read. Check useful relationship labels, readable nodes, fold/
expand, zoom, reset and text outline.

PASS: source-grounded content and functioning controls. Folding, zooming and reset
cause no additional model calls or assessment/mastery credit.

### T12 — Visual walkthrough and numeric controls

Ask in Learn for a step-through of two concurrent requests sharing pending work;
then request an appropriate TTL/read-frequency example with numeric controls if
that format is offered. Exercise Play/Pause, Next/Back, scenario/reset and sliders.

PASS: controls change the explanation consistently and locally; hypothetical examples
are labeled as illustrative. No external page or coding action executes from the
visual. An unavailable format is reported honestly and recorded as unavailable,
not replaced with a fake success.

### T13 — Flashcard deck

Request a small deck about cached snapshots, invalidation, TTL and pending requests.
Check that backs are hidden, flip works smoothly, Previous/Next and progress work,
and per-card recall ratings persist. Leave and resume from History.

PASS: remembered/missed ratings are self-reports, not assessed correctness or mastery.
Flip/rate/navigation/restart controls add no model calls.

### T14 — Quiz, confidence and explanation

Request a short choice question. Check that its answer key and explanation are not
shown before submission. Submit an answer with confidence and inspect feedback.
If practical, test a high-confidence wrong answer and a low-confidence correct one
on different questions.

PASS: keyed scoring is correct; confidence does not change the correctness verdict
or automatically diagnose a misconception. Selecting confidence and scoring a keyed
answer require no new model generation.

### T15 — Open answer, help and assessment

Start an open-response question and type a partial draft. Request a hint, then an
interactive clarification without submitting the draft. Verify the original question
and draft remain. Submit a reasoned answer and request a recap.

PASS: private rubric is not exposed; help does not overwrite the pending exercise;
assessment refers to the submitted answer and source; help/reveal conditions remain
attached to evidence; one assisted answer does not become independent mastery.
New help/content and open-response grading may use model calls. Record actual usage.

## E. Chat isolation, memory and recovery

### T16 — Two simultaneous Code chats

Keep chat A's cache lesson/draft open. Start chat B in another unused test project
with a clearly different task, such as a small state-driven HTML interface. Open
Learn in B through its normal startup/launcher flow; then revisit A and its earlier
invitation. Repeat while both chats have activity.

PASS: B does not receive A's raw work, draft, answer, prepared lesson or private
assessment. A's invitation remains bound to A. Relevant prior learner memory may
legitimately inform another chat; that is different from leaking its coding context.
No manual pairing is allowed to repair the test.

### T17 — Local persistence and app restart

Save a draft, a deck rating and an assessed attempt. Close/reopen the panel, then
finish work and let the user quit/reopen Claude. Revisit the intended chat/history.

PASS: intended draft, evidence, ratings and usage survive without duplicates. Off
stays Off. If learning was On, its saved preference may remain On; reconnect must
not be confused with a new learner answer or duplicate fresh task. Do not impose
the old diagnostic prototype's Off-on-restart behavior on this product candidate.

### T18 — Candidate/Codex data separation

If Codex is also installed, confirm its plugin, history and settings were not modified
by Claude setup. The current Claude candidate uses separate test learner storage.

PASS: Codex remains usable; no data reset or unannounced import/overwrite occurs.
Cross-host memory unification is not an acceptance claim of this test candidate.

## F. Stop, failures, update and removal

### T19 — Stop and cancellation

Begin one explicit learning request, then choose Off/Stop while it is genuinely in
flight. Continue a simple coding action independently. Wait for settlement and reopen
Learn to inspect state. If the request finished before Stop, repeat only with the
user's consent or mark cancellation NOT RUN.

PASS: no new tutor calls start while Off; late results do not replace active state;
coding is unaffected. Cancellation is best-effort: do not report unknown partial
provider usage as zero or promise that network billing was reversed.

### T20 — Account/provider/network failure

Where safely available, exercise an already-signed-out/ineligible test account or
an explicitly user-approved temporary network interruption. Do not sign out the
owner, switch accounts, change billing or disable networking without permission.

PASS: visible useful error, preserved draft/state, no extra API/credential fallback,
no endless hidden retry, coding unaffected and a deliberate retry works after the
normal connection is restored. Otherwise mark the negative cases NOT RUN.

### T21 — Reinstall/upgrade from the website

Record existing version/history. Turn learning Off, finish work and run the verified
current website installer again. Follow its restart instructions; if it reports an
older incompatible service, allow its exit period rather than deleting locks.

PASS: correct version is installed, configuration remains valid, unrelated entries
and candidate learner state survive, and normal automatic connection still works.
Record upgrade versus same-version reinstall accurately.

### T22 — Remove and recover (optional destructive-flow test)

Export candidate memory locally if desired. Only with explicit user consent, remove
this candidate through normal Claude plugin controls and its matching Desktop
connector entry. Never delete unrelated configuration or learner data. Reinstall
from the verified website if the user wants it restored.

PASS: unrelated plugins/Codex work, no further candidate hook activity occurs after
normal restart, retained data can be restored and no credentials are touched.

## Acceptance and final report

Save a local Markdown report with these columns for T01–T22:

| Test | PASS / FAIL / BLOCKED / NOT RUN | Observed behavior | Evidence | Issue |
|---|---|---|---|---|

Include environment/install mode, exact artifact/version/hash, relevant screenshots,
source-task identifiers in private diagnostics only, timings, actual model/call usage,
remaining limitations and reproduction steps. Do not put private transcripts or
credentials in a public issue.

Core native acceptance requires T01–T19 and T21 to pass. Report supported-format
coverage accurately within T11–T15. T20 negative failures need safe test conditions;
T22 needs explicit removal consent. Deferred failure/removal cases remain open,
not silently passed. Delayed retention and educational efficacy require longitudinal
study; this session cannot establish them.

Any wrong-chat binding, unconsented coding-chat request, unexpected credential or
provider use, state loss, Off not stopping new learning, hidden answer/rubric leak,
or interference with coding is release-blocking. Stop expanding the rollout and
record the failure. Do not patch the installation, reset state or bypass a guard
and then describe the original website installation as passing.
