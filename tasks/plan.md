# AutoKG branch plan

Research branch only: `codex/autokg`. [Research and baseline](../docs/research/AUTOKG.md).

1. **Identify and compare primary work.** Record attribution, relevant mechanisms and applicability limits. Keep the owner's exact OpenAI reference unresolved until identified. Kickoff reading is complete; upstream results have not been reproduced.
2. **Create the fixed synthetic benchmark and ablation harness.** Encode the eight sequences from the brief, source handles, expected distinctions and forbidden learner claims. Separate train/development examples from held-out cases. Acceptance: deterministic replay, no personal data, reports show individual failures, and graph/no-graph use equal context allowances.
3. **Measure the existing baseline.** After consent for model use, compare no graph with current same-call graph on relevance, grounding, identity errors, stale facts, latency and usage. Acceptance: source/fixture/model hashes and complete reports; no efficacy claim from synthetic judgments.
4. **Choose one change from observed failures.** Candidate options are temporal fact revision or semantic identity handling. Define the data contract, reversible migration and an ablation control before implementation. Acceptance: corrected records survive restart, old assessment history survives, and hard isolation/Off/usage invariants hold.
5. **Compare and decide.** Reject complexity that provides no practical next-decision benefit. Acceptance: paired inspection with uncertainty, unchanged performance gates, full required live evaluation before a behavior milestone, and separate native acceptance before a customer release.

No deadline, package promotion, new service, graph UI or contribution example is authorized by this plan alone. Research kickoff does not displace the first-session and release work on main.
