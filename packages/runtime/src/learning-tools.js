import {sourceExcerpts} from '../../learning/src/sources.js';
import {lessonCodeFocus} from '../../experiences/src/complete-lesson.js';
import {completeLessonSchema} from '../../experiences/src/complete-lesson.js';
import {adaptationSchema,validateAdaptation} from '../../learning/src/adaptive-flow.js';
import {learningDesignSchema,validateLearningDesign} from '../../learning/src/learning-design.js';
import {contrastSchema,validateContrast} from '../../experiences/src/contrast.js';
import {compileFlowArtifact,flowArtifactSchema} from '../../experiences/src/flow-artifact.js';
import {observationCommentary} from '../../learning/src/tutoring-policy.js';
import {graphDeltaSchema} from '../../learning/src/work-graph.js';
import { ToolRegistry } from './tool-registry.js';
const string = maxLength => ({ type: 'string', minLength: 1, maxLength });
const object = (properties = {}, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const goalSchema = object({
  kind: { type: 'string', enum: ['orient', 'core', 'stretch'] }, outcome: string(80), whyNow: string(160),
  minutes: { type: 'integer', minimum: 1, maximum: 15 }, teaser: { type: 'string', maxLength: 200 },
  contextNeeded:{type:'boolean'}, path: {type:'array',items:string(80),maxItems:4}, insight: string(280), skillId: { type: 'string', maxLength: 200 }
}, ['kind', 'outcome', 'whyNow', 'minutes']);
const sourceIds = { type: 'array', items: string(200), maxItems: 6 };

export function createLearningTools({ intent = 'moment', goal, work = [], learner = [], validateExperience, validateGoals,
  build, buildExperience, buildMindMap, requireInteractive = false, requireInsight = false, previous = null, failCount = 0, extraTools = [], preparing = false, practiceOnly = false, reviewOnly = false, planJourney = false, teachingOnly = false, requireAdaptation = false }) {
  if (!['moment', 'goals', 'hint', 'ask', 'assessment', 'recap'].includes(intent)) throw new Error('Unknown learning intent');
  const registry = new ToolRegistry(); const artifacts = new Map();
  const artifact = (type, value) => { const artifactId = `artifact_${artifacts.size + 1}`; artifacts.set(artifactId, { type, value }); return { artifactId, type, ...value }; };
  const lessonSchema=structuredClone(completeLessonSchema);
  if(planJourney)lessonSchema.required.push('journey');else delete lessonSchema.properties.journey;
  const designSchema=structuredClone(learningDesignSchema);
  designSchema.properties.basis.properties.kind.enum=designSchema.properties.basis.properties.kind.enum.filter(kind=>{
    if(['unknown','self_report','exposure'].includes(kind))return true;
    return learner.some(e=>['correct','partial','incorrect'].includes(e.verdict)&&(kind==='delayed_review'?!e.imported&&e.learningEvent?.kind==='delayed_review'&&e.learningEvent.delayMs>=86400000:kind==='assisted_practice'?e.assisted===true||Boolean(e.assistance?.length):e.assisted!==true&&!e.assistance?.length));
  });
  const preparationTools=new Set(['retrieve_work','retrieve_learner','present','teach','present_flashcard','stay_silent']);
  const add = (name, description, inputSchema, execute, terminal = false, available = true, normalizeInput) => registry.register({ name, description, inputSchema, execute, terminal, available:available&&(!preparing||preparationTools.has(name))&&(!reviewOnly||['retrieve_work','retrieve_learner','present','present_flashcard','stay_silent'].includes(name)), normalizeInput });
  const sources = ids => { if (ids.some(id => !work.some(e => e.id === id))) throw new Error('Unknown source ID'); };
  add('retrieve_work', 'Inspect captured frozen evidence by ID; no filesystem or work-agent access.', object({ ids: sourceIds }), input => { sources(input.ids); return input.ids.map(id => work.find(e => e.id === id)); }, false, intent !== 'goals');
  add('retrieve_learner', 'Inspect relevant attempts, assistance and conditions; never write competence.', object(), () => learner.slice(-3), false, intent !== 'goals');
  add('build_interactive', 'Build a visual explorable explanation with scenes, motion, scenarios and step controls. Inspect returned artifact before presenting a demonstrate; never invent artifact IDs.', object({ brief: string(4000) }), async (input, api) => {
    const spec = await build({ brief: input.brief, goal, request: api.request });
    return artifact('interactive', { spec, validation: 'Validated declarative artifact; illustrative, not executed project code' });
  }, false, ['moment', 'ask'].includes(intent) && Boolean(build));
  for (const [name, question] of [['create_question', true], ['create_explanation', false]]) {
    add(name, question ? 'Delegate a bounded question draft with a private rubric; inspect before presenting.' : 'Delegate a concise explanation or trace; inspect before presenting.', object({ brief: string(800) }), async (input, api) => {
      const experience = validateExperience(await buildExperience({ brief: input.brief, question, request: api.request }));
      if (experience.decision !== 'offer' || Boolean(experience.question) !== question || ['demonstrate', 'mind_map'].includes(experience.kind)) throw new Error('Draft does not match the requested teaching tool');
      return artifact('experience', { experience });
    }, false, (intent === 'moment' || intent === 'ask' && !question) && Boolean(buildExperience));
  }
  add('create_mind_map', 'Map concepts and relationships when relevant. Returns bounded declarative data and text-tree fallback; inspect before presenting a mind_map or attaching to answer_question.', object({ brief: string(800) }), async (input, api) => artifact('mind_map', await buildMindMap({ brief: input.brief, goal, request: api.request })), false, ['moment', 'ask'].includes(intent) && Boolean(buildMindMap));
  const publish = input => {
    sources(input.sourceIds);
    const built = input.artifactId ? artifacts.get(input.artifactId) : null;
    if (input.artifactId && !built) throw new Error('Unknown artifact ID');
    const experience = validateExperience(input.experience ?? built?.value.experience);
    if (experience.decision !== 'offer') throw new Error('Present needs an offered experience');
    const captured=sourceExcerpts(work,work.length);
    // A code focus explicitly names its capture. Canonicalize that reference
    // into the section's citation list rather than paying to repeat the ID.
    if(experience.lesson)for(const section of experience.lesson.sections)if(section.code&&input.sourceIds.includes(section.code.sourceId)&&!section.sourceIds?.includes(section.code.sourceId)){
      if((section.sourceIds?.length??0)>=3)throw Error('Too many section citations');
      section.sourceIds=[...(section.sourceIds??[]),section.code.sourceId];
    }
    if(experience.lesson)for(const section of experience.lesson.sections)if(section.code&&!lessonCodeFocus(section,captured))throw Error('Inline code must match an exact captured excerpt and its section cited capture');
    if(experience.lesson)for(const section of experience.lesson.sections)for(const id of section.sourceIds??[]){if(!input.sourceIds.includes(id))throw Error('Lesson citations must use its validated source IDs');if(!captured.some(source=>source.id===id))throw Error('Each lesson citation needs a displayable captured excerpt');}
    if(preparing&&experience.lesson){const files=captured.filter(source=>source.path&&source.status==='Captured host output · excerpt');if(files.length&&!files.some(source=>experience.lesson.sections.some(section=>section.sourceIds?.includes(source.id))))throw Error('Ground the lesson in the captured code: cite at least one actual file source, not only the task');}
    if(preparing&&experience.lesson){const codeFiles=captured.filter(source=>source.path&&/\.(?:[cm]?[jt]sx?|py|rs|go|java|c|cpp|h|rb|php|swift|kt|sql|css|scss|html|vue|svelte|sh|bash|zsh|cs|lua|exs?|scala|dart)$/i.test(source.path)&&source.status==='Captured host output · excerpt');if(codeFiles.length&&!experience.lesson.sections.some(section=>section.code&&codeFiles.some(source=>source.id===section.code.sourceId)))throw Error('Show at least one exact captured code or test assertion as section.code, and explain its actual names and conditions');}
    if(preparing&&!experience.learningDesign)throw Error('Prepared teaching needs a learningDesign hypothesis');
    if(experience.learningDesign)validateLearningDesign(experience.learningDesign,learner);
    if(observationCommentary(experience))return {decision:'silent',reason:'No useful task-grounded teaching was produced.'};
    if (goal && experience.objective !== goal.outcome) throw new Error('Experience must match the selected goal exactly');
    if (experience.kind==='trace'&&build&&built?.type!=='interactive')throw Error('A trace on this surface needs a built interactive visual, not prose alone');
    if ((requireInteractive || experience.kind === 'demonstrate') && (built?.type !== 'interactive' || experience.kind !== 'demonstrate')) throw new Error('Required interactive must be successfully built before presenting a demonstrate');
    if (experience.kind === 'mind_map' && built?.type !== 'mind_map') throw new Error('A mind map must be built before presentation');
    if (built && ({ interactive: experience.kind==='trace'?'trace':'demonstrate', mind_map: 'mind_map' }[built.type] ?? experience.kind) !== experience.kind) throw new Error('Artifact format does not match the experience');
    if (failCount >= 2 && previous && (experience.kind === previous.kind || experience.question && experience.question === previous.question)) throw new Error('Two failures require a changed strategy and problem');
    return { decision: 'offer', experience, experiment: built?.type === 'interactive' ? built.value.spec : null,
      mindMap: built?.type === 'mind_map' ? built.value.spec : null, mindMapText: built?.type === 'mind_map' ? built.value.text : null, sourceIds: input.sourceIds };
  };
  add('present', 'Publish one concise experience and yield. Use an inspected artifactId or author experience directly. Objective must match selected goal. Interactive/mind-map formats require a real matching artifact. Keep rubric private.', object({ experience: { type: 'object' }, sourceIds, artifactId: string(80) }, ['sourceIds']), publish, true, intent === 'moment');
  add('teach',practiceOnly?'Prepare one adaptive practice step: bounded explanation and question, with a learningDesign and private rubric. No complete lesson sections are required. Preserve exact prior reasoning and sources.':'Prepare one complete self-contained lesson, including lesson:{sections:[{title,body}],takeaway}. The learner receives all teaching at once; a question is optional practice, never the lesson itself. Start with learningDesign: identify a useful distinction and the additional learner capability. Supply bounded teaching and one related probe. Offer deeper only for a useful next code question not already answered; otherwise omit it. Optionally include comparison (two cases, one varied feature) or flow (stateful process), never both. The app draws these locally. Each comparison result must preserve source conditions and modal qualifiers; do not use bare-action shorthand for permission. Omit both for a concise explanation. No separate builder or domain catalogue. Aim for body<=220 and question<=160 characters; declared hard limits still apply. Keep rubric private.',object({lesson:lessonSchema,learningDesign:designSchema,title:string(80),objective:string(160),relevance:string(160),body:string(280),question:string(200),rubric:string(3000),hook:string(180),sibling:string(160),deeper:string(160),comparison:contrastSchema,flow:flowArtifactSchema,sourceIds},['learningDesign','title','objective','relevance','body',...(!teachingOnly?['question','rubric']:[]),'hook','sourceIds']),input=>{
    const {flow,sourceIds:ids,...teaching}=input;if(flow&&input.comparison)throw Error('Choose one useful representation');
    const built=flow?artifact('interactive',{spec:compileFlowArtifact(flow)}):null;
    return publish({sourceIds:ids,experience:{decision:'offer',kind:flow?'demonstrate':'explain',...teaching},...(built?{artifactId:built.artifactId}:{})});
  },true,intent==='moment'&&preparing);
  add('present_flow', 'Publish a complete process demonstration and one probe with locally drawn state transitions. Supply plain teaching fields directly, not an experience object or kind. Each flow step shows participant values, a labelled transition and whether it is blocked. No builder call or artifactId. Keep rubric private.', object({title:string(80),objective:string(160),relevance:string(160),body:string(280),question:string(200),rubric:string(3000),hook:string(180),sibling:string(160),deeper:string(160),learningDesign:designSchema,flow:flowArtifactSchema,sourceIds},['title','objective','relevance','body','question','rubric','hook','flow','sourceIds',...(preparing?['learningDesign']:[])]), input => {
    const {flow,sourceIds:ids,...teaching}=input;
    const spec=compileFlowArtifact(flow);
    const built=artifact('interactive',{spec,validation:'Validated local semantic flow'});
    return publish({experience:{decision:'offer',kind:'demonstrate',...teaching},sourceIds:ids,artifactId:built.artifactId});
  }, true, intent==='moment'&&Boolean(build));
  add('present_contrast','Teach a distinction with two cases that vary one named feature, then an explanation and optional probe. All subject content is authored from evidence; no fixed domain model. The runtime renders cases locally and lets the learner reveal the explanation immediately. Supply a learningDesign; keep rubric private.',object({title:string(80),objective:string(160),relevance:string(160),body:string(280),question:string(200),rubric:string(3000),hook:string(180),sibling:string(160),deeper:string(160),learningDesign:designSchema,comparison:contrastSchema,sourceIds},['title','objective','relevance','body','hook','learningDesign','comparison','sourceIds',...(preparing?['question','rubric']:[])]),input=>{
    const {sourceIds:ids,...teaching}=input;return publish({sourceIds:ids,experience:{decision:'offer',kind:'explain',...teaching,comparison:validateContrast(input.comparison)}});
  },true,intent==='moment');
  add('present_flashcard_deck','Publish a reusable 2–12 card deck as plain-text JSON. The fixed UI handles flipping, navigation and self-rated recall. Make distinct, focused cards; no HTML or UI code.',object({title:string(80),objective:string(160),relevance:string(160),cards:{type:'array',minItems:2,maxItems:12,items:object({front:string(200),back:string(800),objective:string(160)})},sourceIds}),input=>publish({sourceIds:input.sourceIds,experience:{decision:'offer',kind:'flashcard_deck',title:input.title,objective:input.objective,relevance:input.relevance,body:'Recall each idea, flip to check, then rate what you remembered.',cards:input.cards,hook:`Practise a deck about ${input.objective}`.slice(0,180)}}),true,intent==='moment');
  add('present_quiz','Publish one multiple-choice quiz in the fixed question/confidence UI. Return only JSON content. The answer key and explanation stay private until submission.',object({title:string(80),objective:string(160),relevance:string(160),question:string(200),options:{type:'array',minItems:2,maxItems:6,items:string(200)},correctIndex:{type:'integer',minimum:0,maximum:5},explanation:string(800),sourceIds}),input=>{if(input.correctIndex>=input.options.length||new Set(input.options).size!==input.options.length)throw Error('Quiz needs distinct options and a valid answer index');return publish({sourceIds:input.sourceIds,experience:{decision:'offer',kind:'multiple_choice',title:input.title,objective:input.objective,relevance:input.relevance,body:'Choose an answer and how sure you are before checking.',question:input.question,choices:input.options,correctAnswer:input.options[input.correctIndex],quizExplanation:input.explanation,rubric:input.explanation,hook:`Check your understanding of ${input.objective}`.slice(0,180)}});},true,intent==='moment');
  add('present_flashcard', 'Publish one reusable recall card as bounded JSON, without HTML. For an explicitly requested set or deck, use present_flashcard_deck instead. The back is hidden until reveal or submission.', object({title:string(80),objective:string(160),relevance:string(160),front:string(200),back:string(800),sourceIds,learningDesign:designSchema},['title','objective','relevance','front','back','sourceIds',...(preparing?['learningDesign']:[])]), input => publish({sourceIds:input.sourceIds,experience:{...(input.learningDesign?{learningDesign:input.learningDesign}:{}),decision:'offer',kind:'flashcard',title:input.title,objective:input.objective,relevance:input.relevance,body:'Recall the idea in your own words before checking the answer.',question:input.front,answer:input.back,rubric:input.back,hook:`Practise reasoning about ${input.objective}`.slice(0,180)}}), true, intent === 'moment');

  // Graph data is an independent side result. Validate it after the opportunity
  // has completed, so bad graph content cannot spend a model repair request.
  add('suggest_goals', 'Offer a few contextual goals, ordered orient/core/stretch when applicable. Use the declared field bounds. Skill identities are runtime-owned: omit skillId. Outcome is a finished plain-text headline, no backticks. Optional graphDelta records encountered mechanisms separately from teaching need. No lesson or coding solution yet.', object({ goals: { type: 'array', minItems: 1, maxItems: 4, items: {...goalSchema,required:[...goalSchema.required,...(requireInsight?['insight']:[])]} }, alreadySolid: { type: 'array', items: string(160), maxItems: 12 }, graphDelta:{} }, ['goals']), input => validateGoals({ decision: 'offer', ...input }), true, intent === 'goals', input => {
    if (!Array.isArray(input?.goals) || !validateGoals) return input;
    const valid = input.goals.filter(goal => { try { validateGoals({ decision: 'offer', goals: [goal] }); return true; } catch { return false; } });
    // Keep complete valid content unchanged; never shorten a goal or invent one.
    // If none survives, return the original so schema errors remain actionable.
    if (!valid.length) return input;
    const rank = { orient: 0, core: 1, stretch: 2 }; const seen = new Set();
    return { ...input, goals: valid.sort((a, b) => rank[a.kind] - rank[b.kind]).filter(g => { const key = g.outcome.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 4) };
  });
  add('provide_hint', 'Give one scaffold without revealing the pending answer; retain current question and draft.', object({ hint: string(400) }), input => input, true, intent === 'hint');
  add('answer_question', 'Answer immediately and retain pending question/draft and original assessment. Optionally attach an inspected mind-map or interactive artifactId as help; never provide the pending answer.', object({ answer: string(600), artifactId: string(80) }, ['answer']), input => {
    const built = input.artifactId ? artifacts.get(input.artifactId) : null;
    if (input.artifactId && (!built || !['mind_map', 'interactive'].includes(built.type))) throw new Error('Help needs a successfully built map or interactive artifact');
    if (requireInteractive && built?.type !== 'interactive') throw new Error('An explicitly requested interactive must be built and attached before answering');
    return { answer: input.answer, ...(built?.type === 'mind_map' ? { mindMap: built.value.spec, mindMapText: built.value.text } : {}), ...(built?.type === 'interactive' ? { experiment: built.value.spec } : {}) };
  }, true, intent === 'ask');
  add('assess_answer', 'Assess the submitted current answer against its rubric. Runtime records assistance and practice conditions; never award mastery or rewrite earlier attempts.', object({ verdict: { type: 'string', enum: ['correct', 'partial', 'incorrect'] }, feedback: string(600), next: string(200), adaptation:adaptationSchema, evidenceLabel: { type: 'string', enum: ['exploring', 'practiced_with_assistance', 'first_independent_evidence', 'unassisted_practice'] } }, ['verdict', 'feedback', 'next',...(requireAdaptation?['adaptation']:[])]), input => ({ ...input,...(input.adaptation?{adaptation:validateAdaptation(input.adaptation)}:{}), evidenceLabel: input.evidenceLabel ?? 'exploring' }), true, intent === 'assessment');
  add('create_recap', 'Summarize actual practice, assistance, uncertainty and one next step. No invented independent capability.', object({ recap: string(600) }), input => input, true, intent === 'recap');
  add('stay_silent', 'Yield with a short reason when no intervention is useful or a requested format is unavailable. For opportunity decisions, optional graphDelta may still record meaningful work encounters.', object({ reason: string(400), ...(intent==='goals'?{graphDelta:{}}:{}) },['reason']), input => ({ decision: 'silent', reason: input.reason,...(Object.hasOwn(input,'graphDelta')?{graphDelta:input.graphDelta}:{}) }), true, ['goals', 'moment'].includes(intent));
  for (const tool of extraTools) registry.register(tool);
  return registry;
}

// Use the same registered bounds at generation and execution. Optional display
// metadata is omitted from this small first-offer contract; no tool is executed
// until the ordinary registry has independently validated the returned call.
export function opportunityResponseSchema(registry){
  const tools=registry.describe(),suggest=tools.find(t=>t.name==='suggest_goals');
  if(!suggest||tools.some(t=>!['suggest_goals','stay_silent'].includes(t.name)))return undefined;
  const goal=structuredClone(suggest.inputSchema.properties.goals.items);
  delete goal.properties.skillId;delete goal.properties.teaser;
  goal.required=Object.keys(goal.properties);
  return {type:'object',additionalProperties:false,required:['tool','input','reason'],properties:{
    tool:{type:'string',enum:tools.map(t=>t.name)},reason:{type:'string',minLength:1,maxLength:160},
    input:{anyOf:[{type:'object',additionalProperties:false,required:['goals','graphDelta'],properties:{goals:{...suggest.inputSchema.properties.goals,maxItems:2,items:goal},graphDelta:graphDeltaSchema}},{type:'object',additionalProperties:false,required:['reason','graphDelta'],properties:{reason:{type:'string',minLength:1,maxLength:400},graphDelta:graphDeltaSchema}}]}
  }};
}
