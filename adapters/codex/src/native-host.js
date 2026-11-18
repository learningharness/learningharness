import {publicTaskText} from "../../../packages/hosts/src/public-work.js";
import { createCodexHost } from "./host.js";
import {redactText} from "../../../packages/learning/src/redaction.js";
import { nativeCapabilities } from "../../../packages/hosts/src/native-host.js";
const codexNativePresentation = { entryMetadata: (scope) => ({ "openai/ui": { entrypoints: [{ type: scope === "global" ? "global" : "thread" }] } }), sidebar: "verified", identity: "tool-metadata" };
async function createCodexNativeHost(options, createHost = createCodexHost) {
  const host = await createHost(options);
  return {
    ...host,
    capabilities: nativeCapabilities("codex", "codex-chatgpt-login"),
    presentation: codexNativePresentation,
    connection: async () => ({connected:!host.gateway.rpc.closed,via:"codex-chatgpt-login"}),
    checkpoint: (session) => session.hostSeen ?? session.codexSeen,
    async getOpeningContext(id) {
      // Read from the oldest end, independently of the bounded recent-work
      // observer. Never replay the opener as a newly submitted coding task.
      let cursor;
      for (let page=0;page<4;page++) {
        const turns=await host.gateway.rpc.request("thread/turns/list",{threadId:id,limit:4,sortDirection:"asc",itemsView:"notLoaded",...(cursor?{cursor}:{})});
        for (const turn of turns.data) {
          let itemCursor;
          for (let itemsPage=0;itemsPage<4;itemsPage++) {
            const items=await host.gateway.rpc.request("thread/items/list",{threadId:id,turnId:turn.id,limit:16,sortDirection:"asc",...(itemCursor?{cursor:itemCursor}:{})});
            for (const {item} of items.data) {
              const text=publicTaskText(item);
              if(text===null)continue;
              return text.trim()?{id:item.id,text:redactText(text)}:null;
            }
            itemCursor=items.nextCursor;
            if(!itemCursor)break;
            if(itemsPage===3)throw Error("Opening user message unavailable within lookup budget");
          }
        }
        cursor=turns.nextCursor;
        if(!cursor)return null;
      }
      throw Error("Opening user message unavailable within lookup budget");
    },
    async getSession(id) {
      const { thread } = await host.gateway.rpc.request("thread/read", { threadId: id, includeTurns: false });
      return { title: thread.name || thread.preview, project: thread.cwd };
    }
  };
}
export {
  codexNativePresentation,
  createCodexNativeHost
};
