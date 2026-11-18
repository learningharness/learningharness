---
description: Open LearningHarness beside this coding chat
---

The user explicitly wants to open LearningHarness in this Claude Code chat. Call the LearningHarness `open_learn` tool once using this chat's automatic `chatBinding` from its SessionStart control. Use tool search if necessary to find that tool. Do not call `show_learning_launcher`, generate a lesson, enable learning, or change the coding task. Do not submit another prompt. The tool opens the existing MCP App; the host decides whether to show the side panel or a compact reusable launcher. Missing binding must fail closed: explain the connection is unavailable, never guess an ID or borrow another chat's binding. Keep any response to one short sentence.
