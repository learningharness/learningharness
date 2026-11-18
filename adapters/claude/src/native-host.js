import { readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {readClaudeSession} from "./chat-binding.js";
import { createClaudeHost } from "./host.js";
import { nativeCapabilities } from "../../../packages/hosts/src/native-host.js";
const key = (id) => createHash("sha256").update(id).digest("hex");
function createClaudeNativeObserver({ directory, normalize, onEvent, getSeen = () => [], onCheckpoint = async () => {
} }) {
  let id;
  return { attach(value) {
    id = value;
  }, async poll() {
    if (!id) return;
    const folder = join(directory, "events", key(id));
    let files;
    try {
      files = (await readdir(folder)).filter((f) => /^[0-9a-f]{64}\.json$/.test(f)).sort();
    } catch (e) {
      if (e.code === "ENOENT") return;
      throw e;
    }
    const seen = new Set(getSeen(id) || []);
    const records = await Promise.all(files.slice(0, 100).map(async (file) => ({ file, event: JSON.parse(await readFile(join(folder, file), "utf8")) })));
    records.sort((a, b) => (a.event.at ?? 0) - (b.event.at ?? 0));
    for (const { file, event } of records) {
      if (event.sessionId !== id) throw Error("Observation chat identity mismatch");
      if (!seen.has(event.id)) {
        for (const item of event.events ?? normalize(event)) {
          if (item.sessionId !== id) throw Error("Observation event identity mismatch");
          await onEvent(item);
        }
        seen.add(event.id);
        await onCheckpoint(id, [...seen].slice(-200));
      }
      await unlink(join(folder, file));
    }
  } };
}
const claudeNativePresentation = { entryMetadata: () => ({}), sidebar: "unverified", identity: "requires-tool-metadata" };
async function createClaudeNativeHost({ directory, stateDirectory = directory, modelTransport = "bridge", ...options }) {
  const host = await createClaudeHost({ directory, stateDirectory, ...options });
  if(modelTransport === "cli") host.gateway.transport = "cli";
  return {
    ...host,
    capabilities: nativeCapabilities("claude", modelTransport === "cli" ? "claude-cli-subscription" : "claude-session-subscription-bridge"),
    // MCP Apps standard resource linkage. Do not copy OpenAI entrypoints into Claude.
    presentation: claudeNativePresentation,
    connection: async (id) => {const status=id?await host.refreshAuth(id):host.auth();return {connected:!!status.connected,via:status.via??host.gateway.transport};},
    checkpoint: (session) => session.hostSeen,
    async getSession(id) {
      if(modelTransport === "cli") return readClaudeSession(stateDirectory,id);
      const session = (await host.listThreads()).find((s) => s.id === id);
      if (!session) throw Error("This Claude Code chat is not connected. Enable the LearningHarness session bridge in this chat.");
      return { title: session.name, project: session.cwd };
    },
    createObserver: (options2) => createClaudeNativeObserver({ directory: stateDirectory, normalize: host.normalize, ...options2 })
  };
}
export {
  claudeNativePresentation,
  createClaudeNativeHost,
  createClaudeNativeObserver
};
