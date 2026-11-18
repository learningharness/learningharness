# LearningHarness for Claude Code — native candidate

Requires the local Claude Code CLI, signed in with an active Claude subscription.
Claude Desktop sign-in alone may not cover the CLI. If needed, run
`claude auth login` and use Claude's normal browser flow with the intended account.
LearningHarness does not collect your password or extract login tokens. It runs a
separate Claude CLI process; learning consumes your usual subscription allowance.
An installed or signed-in CLI does not prove its account still has a subscription.
No extra API key, silent provider fallback or LearningHarness model backend.

Installation agents must tell the user this requirement before declaring setup
complete, even when a sign-in check succeeds. Never request credentials in chat.
Do not run login on the user's behalf or sign out a different account silently.

Use Claude Desktop's **Code** tab. General Chat and Cowork are not supported by
this candidate. Enable the installed plugin using Claude’s normal controls,
then start a new Code chat. Click **Learn** beside the model picker, or type
**/learningharness:learn**, to open Learn explicitly.
You can also ask Claude to open LearningHarness. The command makes one normal,
user-requested tool call; it is not a zero-model native shortcut. No launcher card
is requested automatically at chat start. The Learn button runs the actual command
without a generated prose prompt; Claude may queue it while another turn runs.

The existing web UI asks Claude to open in the side panel. Claude decides whether
that preference can be honored. If it stays inline, use **Claude’s expand control** on the app card.
The compact instruction points to that icon: “Click ⤢ above to open Learn.”
There is no separate LearningHarness expansion button. Keep that card to reopen Learn
locally without a new prompt or model call. Closing the panel never embeds the
full lesson in the coding transcript. Opening does not itself generate a lesson
or turn learning On. Hooks connect the exact chat automatically; there is no
session-ID field or newest-chat fallback. Missing connection fails closed.

Onboarding explains activity access and asks for acknowledgement before turning learning On.
It does not require a `/hooks` command or a separate hook-approval prompt in Desktop.
The acknowledgement is not evidence that hooks loaded; verify automatic chat connection separately.
Off captures no work and starts no model request. Closing a panel does not turn
learning Off. Use the On/Off control to stop learning. Learner evidence and settings
are local and survive upgrades; unrelated plugins/configuration must be preserved.

This package is an experimental release candidate for public testing, not a stable release. Native identity,
placement/reopen, independent lesson/visual/assessment, restart, cancellation,
install/upgrade and live-evaluation acceptance are still required. Passing unit or
browser tests alone does not establish Claude Code compatibility.

## Install the candidate archive

Unzip the package. Ask your coding agent to read this README and run
`node install.mjs` from the unpacked folder. It uses Claude's normal plugin
commands, backs up Desktop configuration and adds only the candidate connector.
Quit and reopen Claude after installation, then start a fresh Code
chat and ask it to open LearningHarness. No session-ID copying is expected.

The archive is provided for experimental testing; it is not listed in Anthropic's directory.
A directory-only install does not yet register the required Desktop connector.
Do not declare setup complete until that supported setup path is tested.

Maintainers can test the marketplace package from its unpacked directory with:

```sh
claude plugin marketplace add .
claude plugin install learningharness@learningharness-claude-candidate
```

The connector setup above is still required for the current candidate.


Background opportunities and lessons use the selected teaching model by default. An explicitly selected opportunity model takes precedence. The footer updates locally to “Learn · on” or “Learn · ready” on Desktop, including after a coding turn ends. It reads the installer’s exact state root every5seconds, makes no model request and never opens the panel itself. The first opening still runs the real Learn command.

Bash file capture verifies changes to up to6literal redirected/tee code-file destinations inside the working directory using before/after hashes. It excludes credentials, symlinks, expansions, unchanged files and failed calls. Arbitrary shell programs or dynamically computed file paths are not claimed as captured; Write/Edit and explicit Read hooks remain supported. No project-wide scan or transcript reading is added.
