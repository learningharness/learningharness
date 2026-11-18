import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,symlink,mkdir,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {captureClaudeHook} from '../src/native-events.js';

async function fixture(run){const root=await realpath(await mkdtemp(join(tmpdir(),'lh-shell-')));try{const cwd=join(root,'work'),state=join(root,'state');await mkdir(cwd);await mkdir(state);await run({root,cwd,state});}finally{await rm(root,{recursive:true,force:true});}}
const hook=(cwd,phase,command,id='shell')=>({session_id:'chat',cwd,hook_event_name:phase,tool_name:'Bash',tool_use_id:id,tool_input:{command},tool_response:{stdout:'tests passed'}});
async function events(state){let out=[];for(const d of await readdir(join(state,'events'),{withFileTypes:true}).catch(()=>[])){for(const f of await readdir(join(state,'events',d.name)))out.push(...JSON.parse(await readFile(join(state,'events',d.name,f),'utf8')).events);}return out;}
test('shell file writes capture verified code, not just the command, and survive replay',()=>fixture(async({cwd,state})=>{
 const command="cat > cache.mjs <<'EOF'\nexport const cache = new Map();\nEOF\nnode --test";
 await captureClaudeHook(state,hook(cwd,'PreToolUse',command));
 await writeFile(join(cwd,'cache.mjs'),'export const cache = new Map();\n');
 await captureClaudeHook(state,hook(cwd,'PostToolUse',command));
 await captureClaudeHook(state,hook(cwd,'PostToolUse',command));
 const code=(await events(state)).filter(e=>e.type==='file.changed');assert.equal(code.length,1);assert.equal(code[0].data.path,join(cwd,'cache.mjs'));assert.equal(code[0].data.content,'export const cache = new Map();\n');
}));
test('unchanged or failed shell writes do not claim completed changes',()=>fixture(async({cwd,state})=>{
 const command='cat > cache.mjs';await writeFile(join(cwd,'cache.mjs'),'same');await captureClaudeHook(state,hook(cwd,'PreToolUse',command));await captureClaudeHook(state,hook(cwd,'PostToolUse',command));
 await captureClaudeHook(state,hook(cwd,'PreToolUse',command,'failed'));await writeFile(join(cwd,'cache.mjs'),'different');await captureClaudeHook(state,hook(cwd,'PostToolUseFailure',command,'failed'));assert.equal((await events(state)).filter(e=>e.type==='file.changed').length,0);
}));
test('shell capture excludes sensitive paths, traversal, symlinks and expansions',()=>fixture(async({root,cwd,state})=>{
 await writeFile(join(root,'outside.mjs'),'outside');await symlink(join(root,'outside.mjs'),join(cwd,'link.mjs'));
 const command='cat > ../outside.mjs; cat > link.mjs; cat > .env; cat > "$SECRET"; cat > credentials.json';await captureClaudeHook(state,hook(cwd,'PreToolUse',command));await writeFile(join(root,'outside.mjs'),'changed');await writeFile(join(cwd,'.env'),'PRIVATE');await captureClaudeHook(state,hook(cwd,'PostToolUse',command));assert.equal((await events(state)).filter(e=>e.type==='file.changed').length,0);assert(!JSON.stringify(await events(state)).includes('PRIVATE'));
}));
