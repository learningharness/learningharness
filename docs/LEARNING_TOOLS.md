# Learning tools and content contracts

LearningHarness owns the interface, validation and interaction behavior. The model selects a useful teaching move and returns bounded content. It does not generate flashcard, quiz or mind-map UI code.

| Learning experience | Content/tool contract | Fixed interaction and learning record |
| --- | --- | --- |
| Flashcard deck | `present_flashcard_deck`: title, objective, relevance, 2–12 cards with front/back/objective, source IDs | Flip, Previous/Next, per-card I knew this/Not yet, progress and summary; saved deck resumes after restart or from same-chat History. Ratings are self-reported recall, not assessed correctness. |
| Confidence quiz | `present_quiz`: one question, 2–6 distinct options, correctIndex, explanation, source IDs | Answer plus Low/Medium/High confidence. The runtime privately stores the key and scores choices locally; explanation appears after submission. Confidence and correctness remain separate evidence. |
| Open-response practice | `present` or `create_question`: bounded question and private rubric | Fixed answer field, confidence selector, hint and assessment feedback. Model-assisted grading, with assistance and uncertainty retained. |
| Mind map | `create_mind_map`: bounded title/root/children tree | D3 hierarchy lays out the map. Fixed collapse/expand, zoom/reset, scrolling and accessible text outline. No model-generated SVG/HTML or CDN. |
| Visual walkthrough | `build_interactive`, then `present` with its artifact ID | Validated scene data, fixed Play/Pause, Next/Back, scenario choice and step explanations. Process content is generated; player UI is predefined. |
| Numeric simulation | `build_interactive`: bounded controls/expressions/outcomes | Fixed sliders, outputs and reset. Interaction is exploration, not evidence of understanding. |
| Explanation | `present` / `create_explanation` | Short explanation, grounded source references and consistent follow-up actions. Content is generated; layout is fixed. |
| Hint / clarification | `give_hint` / `answer_question` | Fixed help presentation. Help is recorded for the current assessment; it does not replace the learner's draft or imply success. |
| Recap | `create_recap` | Fixed summary presentation based on actual practice, help, uncertainty and a next step. |
| Spaced refresher | Runtime review ledger, using the content tools above | Local project-relevant reviews; assessed practice uses the existing 1/7/30-day progression. Self-reports and uncertain/confident-error cases do not certify retention. |

Legacy single-card records and `present_flashcard` remain compatible. New explicit flashcard requests use decks. Confidence-low correct answers stay correct; they are marked uncertain, not asserted to be lucky guesses. Confidence-high errors are a signal to revisit a gap, not a diagnosed misconception. High confidence alone never awards mastery.

All generated text is rendered as text. Flashcard backs and quiz keys remain private until their relevant reveal/submission. Flips, ratings, navigation, map controls and keyed quiz scoring use no model calls. Open-response grading and generating new content do use the host model. Learner events and confidence belong to local learner memory and ordinary tutoring context, not analytics payloads.

## Contribute a learning tool or experience

Start with a concrete learner situation and the smallest interaction that would help. Discuss a new format in an issue before building a new framework.

1. Define bounded inputs and outputs in the learning tool contract in `packages/runtime/src/learning-tools.js`. Keep assessment keys and rubrics out of learner-visible fields.
2. Put content validation and local interaction logic in `packages/experiences`. Add synthetic examples for valid, malformed and unsupported content.
3. Implement the view in `packages/ui/src`. Support keyboard use and a narrow host panel. Generated text and artifacts must not gain host tools or access private state.
4. Record only what happened: an opening, an exploration, a self-rating or an assessed attempt. Do not turn clicks or confidence into mastery.
5. Include tests and a short example of the intended teaching move. State which host and native checks you actually ran.

This is currently an in-repository extension path. There is no published third-party plugin SDK yet; proposals should help us discover a useful contract rather than assume one already exists.
