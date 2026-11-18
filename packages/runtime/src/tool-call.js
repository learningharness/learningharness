// Recover only complete goal objects from a canonical, truncated terminal call.
// Missing text, incomplete first goals and executable tools are never inferred.
function completeGoals(text) {
  const prefix = /^\{\s*"tool"\s*:\s*"suggest_goals"\s*,\s*"input"\s*:\s*\{\s*"goals"\s*:\s*\[/;
  const match = prefix.exec(text); if (!match) return null;
  let position = match[0].length; const goals = [];
  while (goals.length < 4) {
    while (/\s|,/.test(text[position] ?? '') && position < text.length) position++;
    if (text[position] !== '{') break;
    const start = position; let depth = 0; let quoted = false; let escaped = false; let complete = false;
    for (; position < text.length; position++) {
      const char = text[position];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') { depth--; if (!depth) { position++; complete = true; break; } }
    }
    if (!complete) break;
    try { goals.push(JSON.parse(text.slice(start, position))); } catch { break; }
  }
  return goals.length ? { tool: 'suggest_goals', input: { goals }, reason: 'Use complete validated goals from an interrupted response' } : null;
}
export function decodeToolCall(raw) {
  const text = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  try {
    const choice=JSON.parse(text);
    // This public trace label is bookkeeping, not generated teaching content.
    // Keep complete goals intact and let the registry validate every field.
    if(choice?.tool==='suggest_goals'&&Array.isArray(choice.input?.goals)&&(!Object.hasOwn(choice,'reason')||(typeof choice.reason==='string'&&!choice.reason.trim())))return {choice:{...choice,reason:'Publish validated learning opportunities'},recovered:true};
    return { choice, recovered: false };
  }
  catch (error) { const choice = completeGoals(text); if (!choice) throw error; return { choice, recovered: true }; }
}
