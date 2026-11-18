# Working on LearningHarness

Read README.md, docs/ARCHITECTURE.md and CONTRIBUTING.md first. Keep a change focused and inspect existing tests before editing behavior.

The tutor owns the learner's skill development, not supervision of the coding agent. Do not send requests or learner responses into the main coding chat without explicit consent. Preserve local memory, hook consent, correct chat binding, usage accounting and Off behavior.

Use synthetic fixtures. Do not access personal learner data, install a plugin, invoke paid models, publish a release or change host permissions merely to test a patch. Report what was actually checked and any unavailable check.

For a learning-behavior milestone, a maintainer-approved live evaluation and inspection of its saved output are required. Offline fixtures do not substitute. Keep failures visible in docs/STATUS.md. Internal evaluation controls must not ship as customer plugin modes.
