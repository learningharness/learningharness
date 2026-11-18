import { captureClaudeHook } from "../../adapters/claude/src/native-events.js";
import { createCodexNativeHost, codexNativePresentation } from "../../adapters/codex/src/native-host.js";
import { createClaudeNativeHost, claudeNativePresentation } from "../../adapters/claude/src/native-host.js";
import { assertNativeHost } from "../../packages/hosts/src/native-host.js";
import { identityFrom, validSessionId, readinessOutput } from "../../packages/hosts/src/native-host.js";
const hostID = process.env.LEARNING_HARNESS_HOST || "codex";
if (!["codex", "claude"].includes(hostID)) throw Error("Unsupported learning host");
const presentation = hostID === "codex" ? codexNativePresentation : claudeNativePresentation;
async function createNativeHost(options) {
  return assertNativeHost(await (hostID === "codex" ? createCodexNativeHost : createClaudeNativeHost)(options));
}
const captureHook = hostID === "claude" ? captureClaudeHook : async () => {
};
export {
  captureHook,
  createNativeHost,
  hostID,
  identityFrom,
  presentation,
  readinessOutput,
  validSessionId
};

// Legacy internal Codex navigation/trial helpers are outside the shared engine.
export async function generateTrial(id,preference){
 if(hostID!=='codex')throw Error('Synthetic trial is only available in the Codex development candidate.');
 return (await import('./quiz.mjs')).generateQuiz(id,preference);
}
