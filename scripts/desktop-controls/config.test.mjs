import test from 'node:test';import assert from 'node:assert/strict';
import {desktopConfig} from './config.mjs';
test('Claude helper pins explicit installed root and foreground host, without guessing a session',()=>{
 const config=desktopConfig({LH_DESKTOP_HOST:'claude',LH_DESKTOP_DATA_DIR:'/tmp/claude-fixture'},'/tmp/home');
 assert.deepEqual(config,{host:'claude',hostName:'Claude',bundle:'com.anthropic.claudefordesktop',dataDirectory:'/tmp/claude-fixture'});
 assert.throws(()=>desktopConfig({LH_DESKTOP_HOST:'claude'},'/tmp/home'),/explicit/i);
 assert.throws(()=>desktopConfig({LH_DESKTOP_HOST:'other'},'/tmp/home'),/host/i);
 assert.throws(()=>desktopConfig({LH_DESKTOP_HOST:'claude',LH_DESKTOP_DATA_DIR:'relative'},'/tmp/home'),/absolute/i);
});
test('existing Codex helper default stays scoped to Codex',()=>{
 assert.deepEqual(desktopConfig({},'/tmp/home'),{host:'codex',hostName:'Codex',bundle:'com.openai.codex',dataDirectory:'/tmp/home/.local/share/learning-harness/codex'});
});
