# AutoKG exploration

Status: research kickoff, November 19, 2026. Branch: `codex/autokg`, based on `d6bbb227d21163391234ada8270fb39f4d9cf790`. No new customer behavior or release.

## Question

Can a small, evolving graph of encountered work and learning evidence help LearningHarness choose a more useful next lesson, explanation or review than its existing context and memory?

The product outcome is a better learning decision. Graph size and attractive visualization are not success measures. First-session reliability and source-linked releases remain separate product priorities. Contribution examples are deferred.

## What the research establishes

“AutoKG” names multiple projects. The specific OpenAI result mentioned by the owner is not yet identified. Do not attribute the papers below to OpenAI or treat a cookbook as evidence of a validated learner model.

| Primary source | Relevant idea | Limit when applying it here |
| --- | --- | --- |
| [OpenAI Cookbook: Temporal Agents with Knowledge Graphs](https://developers.openai.com/cookbook/examples/partners/temporal_agents_with_knowledge_graphs/temporal_agents), July 22, 2025, OpenAI and partner authors | Incremental extraction, time-aware validity, updating conflicting facts and graph retrieval. It builds on Graphiti-style techniques. | Engineering guidance for evolving factual knowledge, not evidence of learning gains. A project's current implementation and a person's assessed understanding require different update rules. |
| [Chen and Bertozzi: AutoKG](https://arxiv.org/abs/2311.14740), November 2023 | LLM keyword extraction, graph Laplace learning for relationship weights, and hybrid graph/vector retrieval. | Association weights do not establish semantic prerequisites or learner understanding. Its retrieval results do not establish teaching value. |
| [Zhu et al.: LLMs for Knowledge Graph Construction and Reasoning](https://arxiv.org/abs/2305.13168), 2023, revised 2024 | Studies extraction/reasoning capabilities and proposes an AutoKG approach using LLMs and external sources. | This is a different AutoKG from Chen/Bertozzi. More agents or web retrieval are not automatically justified for a local learning companion. |
| [HKUST-KnowComp: AutoSchemaKG](https://github.com/HKUST-KnowComp/AutoSchemaKG) | Separates extraction of entities/events from schema induction through conceptualization; provides construction and retrieval examples. | Web-scale graph construction is a different workload. Start with a bounded local representation and measure usefulness before adopting its infrastructure. |

These are source readings, not reproductions of the published experiments. No upstream implementation, dependency or dataset has been imported. Review licensing and provenance before any reuse.

## Existing implementation to preserve as the baseline

- `packages/learning/src/work-graph.js`: bounded local graph, scoped provisional concepts, proposed relationships, source references, checkpoint replay protection and cycle rejection.
- `packages/runtime/src/learning-engine.js`: graph updates share the existing opportunity request, including a silent result. Graph errors do not spend repair calls or discard a useful offer.
- Current relationships: `skos:broader`, `skos:related`, `lh:usedTogetherIn`. No prerequisite or mastery relationship exists.
- `workGraphContext` retrieves at most six lexical matches within the project scope and an 1,800-character context bound. This is not semantic resolution or graph traversal.
- Reuse depends on supplied candidate IDs or exact normalized label/definition matching. Definitions are not overwritten. Temporal fact revision, semantic alias resolution and correction/export UX remain research gaps.
- Existing graph context primarily supports matching during extraction; graph-enhanced lesson selection is an experiment to evaluate, not an existing demonstrated benefit.

Keep three distinct records: what happened in the work, what concept/relationship the system hypothesizes, and what the learner actually attempted with recorded help and uncertainty. A code change, explanation, lesson opening or repeated encounter cannot award competence. A project fact becoming obsolete must not erase historical practice.

## First experiment: continuity across changed work

Use synthetic sequences with fixed source handles and timestamps. Compare:

1. Existing recent context and learner memory, with graph context ablated.
2. Current bounded same-call graph and lexical matching.
3. A proposed temporal/alias-aware candidate, only after its data contract is reviewed.

Hold the model, task context, context allowance and teaching policy constant. Account for graph tokens within that allowance. Report any extra extraction requests separately. Fix case expectations before inspecting candidate output. Include both repeated runs and blinded paired judgments; an automatic judge is supporting evidence.

| Sequence | What a useful decision must preserve |
| --- | --- |
| Fixed cache expiry, repeated with different wording | Reuse the mechanism without treating repetition as learning or automatically repeating the lesson. |
| Fixed expiry changes to sliding expiry | Keep the distinction and history; retrieve the currently evidenced mechanism. |
| Same label, different mechanism | Avoid falsely merging distinct concepts. |
| Retry safety revisited in payment work | Offer a grounded connection when useful; do not infer an unassessed prerequisite or mastery. |
| Task proposes a design, captured code does something else | Preserve intent versus observed implementation and their sources. |
| Same terminology in another project | Preserve scope boundaries; no accidental project facts or learner evidence crossover. |
| Learner corrects a graph hypothesis | Correction wins over repeated model guesses and remains inspectable. |
| Thin, irrelevant or unavailable evidence | Abstain rather than invent structure or force a lesson. |

Measure supported-claim precision, harmful merges/splits, stale-fact use, appropriate abstention and paired next-decision usefulness. Measure end-to-end first-offer latency, graph payload, model calls and accounted tokens. Include learned-evidence contamination, Off behavior, scope isolation, replay and correction persistence as hard checks. Report all cases and failures, not just averages.

## Decisions and promotion bar

Start with local bounded records and existing host model calls. No new database, embeddings service, autonomous crawler, public SDK or graph UI is selected. Temporal revision and alias resolution are hypotheses to test. The initial branch is documentation and baseline validation only; it does not enable a new experiment in the customer runtime.

Before behavior implementation, define schemas and migration/ablation controls. A candidate must improve next-decision usefulness on the fixed cases, avoid unsupported learner claims and stale-source use, and satisfy the existing unchanged latency/usage gates. Do not relax the 15-second first-offer gate to accommodate a graph. Later native acceptance and a maintainer-approved live evaluation are separate requirements.

## Evidence at kickoff

Existing graph tests: **11 passed, 0 failed, 0 skipped** using:

```sh
node --test packages/learning/test/work-graph.test.js packages/runtime/test/opportunity-graph.test.js
```

This verifies existing local invariants, not extraction quality or learning benefit. No paid model call, learner data access or live evaluation was performed. The November 16 live first-offer latency failure (18.099 and 16.538 seconds against 15) remains unresolved; see [status](../STATUS.md).

Implementation order and acceptance criteria: [plan](../../tasks/plan.md), [checklist](../../tasks/todo.md).
