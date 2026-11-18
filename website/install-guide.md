# Install LearningHarness for Codex or Claude Code

Public early access for macOS. The local-plugin invitation keeps Codex’s gray activity header; the lesson opens beside the coding chat.

Use this guide for the host the user requested: Codex desktop or Claude Desktop’s Code tab on macOS. Codex is public early access; Claude is an experimental release candidate. If the intended host is unclear, ask before installing. The Claude instructions are below the Codex section.

## Check availability

Fetch `/install.json` from the same HTTPS origin as this guide. Check `schemaVersion` and `status` before downloading or changing anything.

If the status is `unreleased`, tell the user public installers are not available yet and stop. Do not guess a package, listing, release tag or download URL. If the manifest is unavailable or unsupported, report that installation cannot be verified.

For an `available` release, select exactly one entry in `artifacts` whose `host` matches the requested host (`codex` or `claude`). Never substitute the other host. Read its `channel`, `requirements`, `limitations` and `nativeAcceptance` when present. Resolve its relative download URL against this origin; require HTTPS and the published SHA-256. A checksum checks consistency with the published release; it is not a code signature.

## Codex requirements

Codex desktop on macOS, Node.js 22.19 or later, and an existing Codex sign-in that can complete a normal coding task. This distribution is for the desktop app. **A full ChatGPT desktop app restart is required after registration.** Tell the user before installing so they can save and finish active work. Closing a window or opening a new chat is not a full restart.

## Verify and install

1. Download the Codex ZIP and verify its SHA-256 before running any bundled file.
2. Inspect the archive before extraction. Reject absolute paths, parent-directory traversal and links escaping the extraction directory. Extract into a dedicated temporary directory.
3. Read the bundled setup guide. Check the expected package root and installation entry against the manifest before running it through normal approved local tools. Keep the bundle together. Do not pipe a network response into a shell.
4. Preserve unrelated plugins, existing model connections and learner memory. Follow the release's installation instructions without replacing entire configuration files or removing live writer locks.
5. Before any hook review prompt, explain why it is needed: LearningHarness uses local scripts at chat start, prompt submission and tool completion to identify active work and signal a learning invitation. They do not generate lessons or modify the project. Automatic observation and invitations need this permission. Let the user review plugin permissions and readiness hooks. Do not forge trust, disable macOS protections or approve consent on their behalf. Explain any required user action and resume afterward. After registration, stop at the restart handoff described below. Do not quit or restart the app on the user’s behalf.

## Walk through setup

### Restart required — registration is not completion

After the installer succeeds, say **“LearningHarness is registered. Save and finish active work, fully quit ChatGPT with ChatGPT → Quit ChatGPT (⌘Q), then reopen it. The plugin may not appear until that restart.”** Opening a new chat or closing the window is insufficient. Do not report “ready to use” based only on installer success. Do not automatically quit the user’s app.

After the user reopens ChatGPT, open **Plugins**, choose the **LearningHarness Desktop** source if needed, and find **LearningHarness**. Confirm it is installed and enabled. Then start a fresh Codex coding chat. Select **Review hooks** above the composer or **Settings → Hooks** to review and trust LearningHarness. In the coding chat, choose **Add New Tab (+) → More tools → Open LearningHarness** (called **Learn beside this chat** in earlier versions). Or ask Codex: **“Open LearningHarness.”** Walk the user through this exact route; do not assume they can discover a side-panel tool. If it is still absent, follow `/docs/troubleshooting/`; report what is missing instead of rerunning installation or wiping settings blindly.

Learn includes a short product tour: why learning alongside work is useful, learning interests and style, hook review, and usage/data controls. Let the user make those choices. New setups default to usage alerts of 50,000 tokens per chat and 2,000,000 overall; these are alerts, not hard spending caps. PostHog usage metadata sharing defaults on, with an opt-out in settings. Do not submit setup or claim hook trust on the user's behalf.

Reinstalling keeps memory and settings, so a returning user may go directly to Learn. To revisit onboarding, use Settings → Review setup and hook permissions. Do not wipe their memory to simulate a fresh user.

## Check the experience

Confirm Codex recognizes the plugin and Learn opens beside the intended coding chat. Complete learning setup with the user's interests and usage limits. Use the existing Codex connection; no additional model account or API key is required.

Check chat connection and one learning response when the user requests it. Do not submit learner answers or start costly media generation merely to test installation. Check visible invitations during normal work separately from installation. If a check is unavailable, say which one remains; follow `/docs/codex/` and `/docs/troubleshooting/` without wiping memory.

## Data and usage

Selected work context and relevant learner context go through the existing Codex model connection. Learning consumes additional allowance. LearningHarness has no application backend receiving code, prompts or learner answers. Memory is local, with import/export in settings. Anonymous usage metadata is on by default when configured and can be disabled in Learn; it excludes code, prompts and answers.

## Update or remove

For an update from an older beta, first turn learning **Off** and finish active work. After installing, fully quit ChatGPT with **⌘Q**, wait **90 seconds**, then reopen it. The old local learning service needs time to exit; reopening immediately can reconnect to it. Keep learner memory and settings intact.

Recheck the current manifest and package checksum for updates. Follow the bundled instructions, preserve memory and unrelated settings, finish active work before restarting and review changed hooks. Removing the plugin does not authorize deleting learner memory. Export memory in settings to keep a portable copy.

The final onboarding screen includes a copyable starter task: build a small local cache demo in a separate folder. Copy it, select **Start learning**, then paste and send it in the same Codex chat. Invitations depend on relevant work and can take time. Nothing is sent automatically.

## Claude Code — experimental release candidate

Select the `claude` artifact from `/install.json`. Explain that native automatic chat binding and the complete host integration are still under acceptance testing. This is a test candidate, not a stable or Anthropic-marketplace-approved release. Use the exact host version listed in the manifest; matching product versions do not imply equal native-host acceptance.

### Required sign-in disclosure

Tell the user before installation: **Claude support requires the local Claude Code CLI signed in with an active Claude subscription. Desktop sign-in alone may not cover the CLI. LearningHarness uses a separate local CLI process and additional normal subscription allowance.** It does not collect passwords or extract login tokens and uses no extra API key or LearningHarness model backend.

If needed, the user should run `claude auth login` and finish Claude’s own browser sign-in using the intended account. Never ask for passwords, API keys or login tokens in chat. Never silently sign the user out or log in for them. A signed-in account can still lack an active subscription.

### Verify and install the Claude candidate

1. Require macOS, Node.js 22.19+ and Claude Desktop’s **Code** tab. General Chat and Cowork are not supported by this candidate.
2. Verify the selected manifest artifact’s HTTPS URL and SHA-256, inspect the archive for traversal/escaping links and extract to a dedicated folder. Read its README.
3. Run its declared `install.mjs` with Node through normal approved local tools. The installer registers only its candidate plugin and adds the required Desktop MCP connector, preserving other entries and creating a private config backup. Marketplace-only installation does not currently add that connector.
4. Let the user handle any plugin permission prompts Claude actually presents. Do not require `/hooks`, a separate hook-approval screen or a declaration of hook trust in Desktop. Say: **LearningHarness is registered. Save and finish active work, fully quit Claude with ⌘Q, then reopen it and start a fresh Code chat. Registration alone is not confirmation that it works.** Never quit the app for them or change trust flags.
5. After restart, ask Claude to open LearningHarness using `open_learn` from `learningharness-claude-candidate`. The startup hook should provide automatic chat binding. Click the orange link if shown. Do not ask the user to copy a session ID or guess a recently active chat. If the connection is unavailable, report that native acceptance is pending and stop rather than claiming success.
6. Let the user choose interests, read the activity-access explanation and decide when to turn learning On. The acknowledgement is not a hook-connection check. Do not submit setup, learner answers or model tests without consent. Verify panel reopen and one learning response only when requested.

The candidate uses separate local test learner state from the installed Codex package. Preserve it and unrelated settings on updates. Closing Learn is different from turning it Off. The public Claude guide is `/docs/claude-code/`.
