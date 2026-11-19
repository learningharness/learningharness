# LearningHarness

Learn from the work you build with coding agents.

Coding agents let us build things we haven't fully understood yet. LearningHarness puts a learning agent alongside that work. It finds things worth understanding and offers explanations, questions and practice while the coding agent keeps going.

Started and maintained by [arvindm1991](https://github.com/arvindm1991). Built with Codex. Contributions are welcome under the [MIT license](LICENSE).

[Try the beta](https://learningharness.dev/install.md) · [Documentation](https://learningharness.dev/docs/) · [Contribute](CONTRIBUTING.md) · [Direction](ROADMAP.md)

## Try it

Paste this into your coding agent:

> Install LearningHarness using the instructions at https://learningharness.dev/install.md

The install guide checks the [release manifest](https://learningharness.dev/install.json) for the right package and checksum. Current installers are hosted on learningharness.dev under `/downloads/`. GitHub source archives are for development, not plugin installation.

| Host | Status | Setup |
| --- | --- | --- |
| Codex desktop | Early access | [Codex guide](https://learningharness.dev/docs/codex/) |
| Claude Desktop's Code tab | Experimental | [Claude guide](https://learningharness.dev/docs/claude-code/) |

Codex setup requires a full app restart and your review of local hooks. Registration alone is not completed setup. Claude also requires the Claude Code CLI signed in with an active subscription. Follow the host guide through the first working session.

## How it works

A local service reads selected work context through the host integration. A separate learning agent finds relevant opportunities and prepares learning. You decide when to open it, explore an explanation or attempt practice. The tutor supports your understanding; it does not supervise the coding agent.

Learning uses your existing model connection and additional allowance. There is no LearningHarness backend receiving your code, prompts or learning responses. Learner history stays on your machine. Anonymous usage metadata is on by default when configured and can be turned off in Settings. [Data flow and controls](https://learningharness.dev/docs/privacy/).

## Contribute

Help with a confusing setup step, an interaction that gets in the way, a learning tool, a useful evaluation case, or a host integration. You do not need to propose a large feature to contribute.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [architecture](docs/ARCHITECTURE.md), and the [roadmap](ROADMAP.md). Small fixes can come straight as a PR. Discuss larger changes in an issue first so we can agree on the learning problem and scope.

## Develop locally

Use Node.js 22.19 or later:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

These checks use local fixtures and do not require a model account. Host installation, real model calls and learning evaluations are separate opt-in checks. [Development and validation](docs/DEVELOPMENT.md).

```text
packages/                 Learning runtime, memory, tools and shared UI
adapters/codex/           Codex host integration
adapters/claude/          Claude host integration
scripts/desktop-runtime/  Local desktop service, hooks and embedded app
scripts/codex-release/    Codex installer and package integration
scripts/claude-release/   Claude installer and package integration
website/                  Website and customer documentation
```

## Status

This is an early project, not a proven learning intervention. The latest published beta and the source development snapshot can differ. Automated tests do not establish fresh-user setup success, native UI reliability or improved learning. See [validation status](docs/STATUS.md) before making claims or releasing a package.

## Community and ownership

Use issues for bugs, setup questions and proposals. A dedicated discussion forum is planned; no external community account is required to contribute. [Governance](GOVERNANCE.md) · [Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md).

This is an independent project. It is not affiliated with or endorsed by OpenAI or Anthropic.
