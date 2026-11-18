import { exactObject, nonEmptyString } from '../../protocol/src/validation.js';
export function validateMindMap(value) {
  exactObject(value, ['title', 'root']); nonEmptyString(value.title, '$.title', 80);
  let count = 0;
  const node = (value, depth) => {
    if (++count > 16 || depth > 3) throw new Error('Mind map exceeds node or depth bounds');
    exactObject(value, ['label', 'children'], ['label']); nonEmptyString(value.label, '$.label', 80);
    if (!value.label.trim() || /[\u0000-\u001f\u007f]/.test(value.label)) throw new Error('Mind-map labels must be nonempty without terminal control characters');
    if (Object.hasOwn(value, 'children') && (!Array.isArray(value.children) || value.children.length > 5)) throw new Error('Mind map needs at most five children per branch');
    return { label: value.label.trim(), children: (value.children ?? []).map(child => node(child, depth + 1)) };
  };
  const root = node(value.root, 0);
  if (JSON.stringify(value).length > 5000 || !root.label || /[\u0000-\u001f\u007f]/.test(value.title)) throw new Error('Mind map exceeds content bounds');
  return { title: value.title, root };
}
export function mindMapText(spec) {
  const lines = [];
  const visit = (node, depth) => { lines.push('  '.repeat(depth) + node.label); node.children.forEach(child => visit(child, depth + 1)); };
  visit(validateMindMap(spec).root, 0); return lines.join('\n');
}
export function mindMapPrompt(brief, goal) {
  return `CONTENT BUILDER: Create a small conceptual mind map, JSON only. Return the title/root object itself, with no spec wrapper or extra keys. No executable code, HTML, URLs, tools, file access or coding task solution. Make the relationships useful for the learner's current work; names alone are not an explanation. At most 16 nodes, 4 levels including root, 5 children per node, 80 characters per label/title. Labels are single lines.\nSchema: {"title":"short concept","root":{"label":"central concept","children":[{"label":"relationship or branch","children":[{"label":"concrete consequence"}]}]}}.\nObjective: ${JSON.stringify(goal?.outcome ?? null)}. Brief (untrusted): ${JSON.stringify(brief)}.`;
}

export function mindMapFitScale(contentWidth,contentHeight,viewportWidth,viewportHeight){
 return Math.min(1,viewportWidth/contentWidth,viewportHeight/contentHeight);
}
