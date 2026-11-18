# Architecture

The tutor helps the learner understand the work. The main coding task continues independently.

1. Approved host integrations supply selected work context and a concrete chat identity.
2. A local runtime selects relevant opportunities using the learner's goals and history.
3. Separate learning-owned model work prepares explanations and practice using the existing host connection.
4. An embedded SolidJS view presents learning when the learner chooses to open it.
5. Local records distinguish exposure, self-report, assessment and review. None alone proves mastery.

## Source map

| Location | Responsibility |
| --- | --- |
| `packages/runtime` | Agent loop, scheduling, budgets, delivery and learner state |
| `packages/learning` | Teaching policy, work selection, relevance, sources and memory |
| `packages/experiences` | Validated learning formats, interactions and presentation contracts |
| `packages/ui` | Shared SolidJS learning view for desktop hosts |
| `packages/hosts` | Host identity and integration contracts |
| `packages/analytics` | Bounded anonymous usage metadata |
| `adapters/codex` | Codex connection and host observations |
| `adapters/claude` | Claude connection and host observations |
| `scripts/desktop-runtime` | Local service, hook handling, app bridge and embedded entry point |
| `scripts/codex-release`, `scripts/claude-release` | Portable host installation and packaging |

The shared UI has been moved out of the retired OpenCode adapter in this source snapshot. Old protocol IDs, stored-data names and migration aliases remain where needed for compatibility. They do not imply current support for a retired host.

## Trust and learning boundaries

A hook is a bounded observation and readiness path, not permission to teach automatically or alter project files. The app bridge binds to an intended chat. A prepared invitation does not prove that the host displayed it. Closing a view and turning learning off are different actions. Unknown model usage must stay unknown rather than being counted as zero.

A work or concept graph records partial evidence and hypotheses. It must not turn an encountered concept into an assessed skill. The current graph experiment has not passed every release gate; see [status](STATUS.md).
