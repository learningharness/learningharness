# Learn alongside Codex

LearningHarness adds a tutor to your existing Codex setup. Codex keeps building while you take small moments to understand the work. No separate model account or API key is needed.

## Install

Ask Codex to run `node install.mjs` from this extracted folder, after reading BETA_NOTICE.md and checking the package checksum. Keep the bundle together. The installer keeps a persistent copy and registers the LearningHarness desktop plugin. You can retry the same verified package if registration is interrupted.

If an older LearningHarness integration is enabled, disable it before enabling this one so two integrations do not watch the same work. Your memory and saved settings are preserved.

The installer registers the plugin; it does not prove that the running app has loaded it. If it is still missing after a full restart, follow https://learningharness.dev/docs/troubleshooting/ .

## Why Codex asks about hooks

A hook is a small local script that runs when a chat starts, you send a prompt or a tool finishes. Our hooks identify the active chat and signal Codex to show a brief invitation when learning is ready. They do not generate lessons or change your project. Teaching is prepared separately using your existing Codex connection.

Installing the plugin does not approve its hooks. In Codex, select **Review hooks** above the composer or open **Settings → Hooks**. Review and trust LearningHarness yourself. Without trust, automatic observation and invitations will not run. Changed hooks may require another review after an update.

## Open Learn

1. **Restart required:** save and finish active work, fully quit the ChatGPT desktop app using **ChatGPT → Quit ChatGPT (⌘Q)**, then reopen it. Closing the window or opening a new chat is not enough. The plugin may not appear until the app restarts.
2. Open **Plugins**, choose the **LearningHarness Desktop** source if needed, and confirm **LearningHarness** is installed and enabled. Start a fresh Codex coding chat.
3. In the coding chat, choose **Add New Tab (+) → More tools → Open LearningHarness** (called **Learn beside this chat** in earlier versions). Or ask Codex: **“Open LearningHarness.”**
4. The short tour shows how to keep Learn beside your coding chat, explains how selected work becomes a learning experience through your existing Codex connection, and helps you choose interests and a learning style. Review the hooks before turning on learning.
5. On the last tour screen, copy the starter task, choose **Start learning**, then paste and send it in the same Codex chat. It builds a small local cache demo in a new folder. You can close Learn while Codex works; leave learning On. Invitations depend on relevant work and may take time. You can also use your own task.

New setups use alerts of **50,000 tokens per chat and 2,000,000 overall**. These are alerts, not hard spending caps or prepaid credit. Learning consumes additional Codex allowance. Change alerts, models and interests in Learn settings. PostHog usage metadata sharing is on by default; turn off **Share anonymous usage** in settings to opt out. Code, prompts and learner answers are excluded.

To return, ask Codex **“Open LearningHarness”** or use **Add New Tab (+) → More tools → Open LearningHarness**. Once learning is On and the hooks are trusted, an invitation can appear during work; click **Open Learn** on that card to open the learning panel. An older invitation may no longer match the current work.

Closing Learn hides the view; **Off** stops learning. Reinstalling does not erase your memory or repeat first-run setup. To revisit the tour, choose **Settings → Review setup and hook permissions**. Export memory in settings before moving devices. Removing the plugin is separate from deleting memory.

This is an early desktop beta. See https://learningharness.dev/docs/troubleshooting/ for help. Report issues without code, answers, credentials or private screenshots.

## Recall and revisit

Use **Make a recall card** from a learning moment, or ask Learn for a flashcard. Try answering before revealing; reveals count as help. Reviews can follow the same project working folder across chats, using local practice history and bounded observed task requests. The current review schedule is1/7/30days; this is not full Anki/FSRS parity and does not notify while the app is closed.

Use **Ask the coding agent for a work summary** to prepare a short request. Review, copy and send it yourself; nothing is automatically inserted into your coding chat.
