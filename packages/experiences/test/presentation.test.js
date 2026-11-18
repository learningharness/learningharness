import test from 'node:test';
import assert from 'node:assert/strict';
import { briefText } from '../src/presentation.js';
test('brief default retains the explanation behind explicit disclosure without inventing or dropping words', () => {
  const text = 'A retry repeats the request. ' + 'A temporary failure may clear between attempts. '.repeat(10);
  const view = briefText(text, 120);
  assert.ok(view.lead.length <= 120); assert.ok(view.more.length > 0);
  assert.equal((view.lead + ' ' + view.more).trim(), text.trim());
  assert.deepEqual(briefText('One idea.'), { lead: 'One idea.', more: '' });
});
