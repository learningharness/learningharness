# Contributing

LearningHarness is for people who want to keep learning while building with agents. Help us make that work well in real coding sessions.

## Start small

A clear bug report, a better explanation in the docs, a confusing setting you can simplify, or a reproducible learning failure is useful. For a small fix, open a PR. For a new learning experience, host integration or architectural change, open an issue first with the problem, an example and the smallest useful version.

Areas to contribute:

- **Learning experiences:** explanations, practice, visual tools and feedback that help someone reason independently.
- **UX and accessibility:** setup, opening and returning to learning, keyboard use, small panels and clear settings.
- **Learning tools:** bounded tool schemas, validation, rendering and examples. See [the tool guide](docs/LEARNING_TOOLS.md).
- **Evaluation:** relevance, timing, accuracy, learner reasoning and transfer to a changed case.
- **Host integrations:** explicit permissions, correct chat binding, safe local installation and recovery.
- **Knowledge and memory:** follow the [roadmap](ROADMAP.md); graph discovery is still research work.

## Work locally

Follow [development setup](docs/DEVELOPMENT.md). Keep changes focused and explain the user-visible result. Preserve memory and installation compatibility. Do not run a model-backed evaluation or install hooks on someone else's account without their consent.

A useful PR explains the problem, the resulting behavior, how it was checked and what is still uncertain. Add a regression test for a behavior fix. For UX changes, show the actual view and include keyboard and narrow-panel checks. For learning changes, include the prompt or synthetic scenario and the observed output, with private information removed. Never report a mocked test as a successful native host session.

AI assistance is welcome. Review what you submit, understand it and say where agents helped when it matters to review. Include the checks you actually ran. You remain responsible for correctness, attribution and the rights to contribute the code. Do not submit large unreviewed generated changes or learner data.

## Review

[arvindm1991](https://github.com/arvindm1991) is the initial maintainer and makes merge and release decisions. We may ask for a smaller change or a reproducible example. No response-time promise is implied. See [governance](GOVERNANCE.md) for how this can grow.

Contributions are offered under this repository's MIT license. Retain third-party copyright and license notices. No separate CLA is currently required.
