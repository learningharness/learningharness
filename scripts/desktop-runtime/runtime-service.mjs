import {restorePreparedMoment} from './prepared-target.mjs';
import {isNativeCommand} from './command-policy.mjs';
import {requireWorkContext} from './work-context.mjs';
import {createDesktopControls} from '../desktop-controls/service.mjs';
import {replyToSocket} from './socket-reply.mjs';
import {createJobJournal} from './job-journal.mjs';
import {createWatchSelector} from './watch-selection.mjs';
import {createInvitationPublisher} from './invitation-publisher.mjs';
import {createDeliveryLedger} from './delivery-ledger.mjs';
import {recordDeliveryReceipt,recordPracticeReceipt,recordOpeningReceipt} from './delivery-receipts.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const build=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
import { createServer } from "node:net";
import { mkdir, readdir, readFile, writeFile, rename, unlink, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createNativeHost, hostID, validSessionId } from "./host-adapter.mjs";
import { localStorage } from "../../packages/hosts/src/local-storage.js";
import {createSessionContextLoader} from "../../packages/runtime/src/host-session-context.js";
import { LearningEngine } from "../../packages/runtime/src/learning-engine.js";
import { loadNodeAnalytics } from "../../packages/analytics/src/node-config.js";
import { chainDirectory, readChain, writeChain,projectRuntimeInvitation } from "./chain.mjs";
import { createStore } from "./state.mjs";
import { memory } from "./personalization.mjs";
const root = join(chainDirectory, "core"), socketPath = join(chainDirectory, "core.sock");
await mkdir(root, { recursive: true, mode: 0o700 });
try {
  const pid = Number(await readFile(join(root, "writer.lock"), "utf8"));
  try {
    process.kill(pid, 0);
    process.exit(0);
  } catch (e) {
    if (e.code !== "ESRCH") throw e;
    await unlink(join(root, "writer.lock"));
    await unlink(socketPath).catch(() => {
    });
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const storage = await localStorage(root);
if (!process.env.DONTDUMB_PROBE_DATA && !await storage.get()) {
  try {
    const legacy = JSON.parse(await readFile(join(homedir(), ".local/share/dontdumb/" + hostID + "/state.json"), "utf8"));
    if (legacy.version === 1 && legacy.sessions && Array.isArray(legacy.history)) await storage.set("dontdumb.runtime.v1", legacy);
  } catch {
  }
}
await unlink(socketPath).catch(() => {
});
let deliveryError='';
const mode = createStore(chainDirectory), jobs = await createJobJournal(root), deliveryLedger=await createDeliveryLedger(root).catch(()=>{deliveryError='Delivery history is unavailable. Automatic preparation is paused; saved lessons and manual learning remain available.';return null;}), observers = new Map();
let host, engine, ensureSession, analytics, error = "", lastLease = Date.now(), revision = 0, ready = false;
const publishInvitation=createInvitationPublisher({getEngine:()=>engine,readChain,writeChain,projectRuntimeInvitation,deliveryLedger,...(hostID==='claude'?{intentGraceMs:10000,settleMs:1000}:{})});
const syncInvitation=async id=>{if(!deliveryLedger)return;try{await publishInvitation(id);}catch{engine.record('native_delivery_failed',id,{status:'unavailable'});}};
const initialization = (async () => {
  host = await createNativeHost({ directory: root, stateDirectory: chainDirectory });
  analytics = await loadNodeAnalytics({ adapter: hostID, surface: "native" });
  const chosen = host.catalog.find((m) => m.isDefault) || host.catalog[0];
  engine = new LearningEngine({ storage, launcherSettings:hostID==='claude'?mode:null, gateway: host.gateway, learnerStore: memory, analytics, defaultLearningModel: { providerID: hostID, modelID: chosen.model }, proactiveFollowup:true, automaticMinIntervalMs:120000, maxAutomaticChecksPerWindow:3, automaticWindowMs:600000, debounceMs: 600, maxAutomaticChecksPerTask: 2, maxGoalRequests: 2, maxLearningRequests: 4, learningTimeoutMs: 3e5, capabilities: host.capabilities, emit: async (_,data) => {
    revision++;
    // Publish readiness on the commit event, not on a later observation poll.
    if(data?.sessionID){void syncInvitation(data.sessionID);if(data.reason==='feedback'&&deliveryLedger)await recordPracticeReceipt(deliveryLedger,data.sessionID,engine.session(data.sessionID)).catch(()=>engine.record('native_delivery_failed',data.sessionID,{status:'unavailable'}));}
  } });
  await engine.load({resumeEnabled:mode.read().on===true});
  ensureSession=createSessionContextLoader({host,engine});
  if (mode.read().on) await engine.command({ action: "enable" });
  ready = true;
})().catch((e) => {
  error = e.message;
  setTimeout(() => {
    void host?.close();
    void storage.close().finally(() => process.exit(1));
  }, 1e4).unref();
});
function observer(id) {
  if (!observers.has(id)) {
    const o = host.createObserver({ onEvent: (e) => engine.onWorkEvent(e), getSeen: (x) => host.checkpoint(engine.session(x)), getTaskId: (x) => engine.session(x).workSelection?.task?.id, onCheckpoint: async (x, seen) => {
      engine.session(x).hostSeen = seen;
      await engine.persist();
    } });
    o.attach(id);
    observers.set(id, o);
  }
  return observers.get(id);
}

let desktopControls;
async function handle(method, p) {
  lastLease = Date.now();
  if (method === "ping") return { ready: !!engine, error, pid: process.pid, version: "0.0.20", build, host: hostID, busy: !!engine?.inflight?.size };
  await initialization;
  if (error) throw Error(error);
  const id = p.id;
  if(method.startsWith('desktop-')){
    if(!['codex','claude'].includes(hostID))throw Error('Desktop controls are unavailable for this host.');
    desktopControls??=createDesktopControls({engine,host,mode,jobs,ensureSession,observe:id=>observer(id).poll()});
    return desktopControls(method,p);
  }
  if (method === "status") {
    if (id) {
      if (!validSessionId(id)) throw Error("Invalid host chat");
      const v = join(chainDirectory, "visible-" + id + ".json"), tmp = v + ".tmp";
      if(p.input?.surfaceVisible===false){await writeFile(v,JSON.stringify({until:0}),{mode:0o600});}
      else {await writeFile(tmp, JSON.stringify({ until: Date.now() + 6e3 }), { mode: 0o600 });await rename(tmp, v);}
      observer(id);
      await ensureSession(id);
    }
    if (id) engine.refreshReview(engine.session(id));
    return { ...engine.snapshot(id), revision, delivery:deliveryLedger?.list(id??undefined).slice(-10)??[], deliveryError, allowance:await host.getAllowance?.()??null, setup:mode.read().setup??null, hostConnection: { host: hostID, sidebar: host.presentation.sidebar, model: await host.connection(id) } };
  }
  if(method==='delivery-receipt'){try{return await recordDeliveryReceipt(deliveryLedger,p);}catch(error){engine.record('native_delivery_failed',id,{status:'unavailable'});throw error;}}
  if(method==='invitation-target'){
    if(!validSessionId(id))throw Error('Exact chat identity required');
    let chain=readChain(id);const restored=restorePreparedMoment(chain,engine.session(id),engine.state);if(restored){writeChain(id,restored);chain=restored;}if(chain?.status==='ready'&&chain.preparedTarget&&engine.session(id).preparedLessons?.[chain.preparedTarget.id]){await deliveryLedger?.record(id,chain.runtimeKey,'prepared',{invitationId:chain.preparedTarget.id}).catch(()=>engine.record('native_delivery_failed',id,{status:'unavailable'}));return chain.preparedTarget;}
    throw Error('No prepared content is available');
  }
  if(method==='open-invitation'){
    if(!validSessionId(id))throw Error('Exact chat identity required');
    const key=crypto.randomUUID();await jobs.create(key,id);
    void engine.openPreparedOpportunity(id,p.target).then(async result=>{await recordOpeningReceipt(deliveryLedger,id,p.target.id,()=>engine.record('native_delivery_failed',id,{status:'unavailable'}));return jobs.settle(key,{status:'ready',result});}).catch(error=>jobs.settle(key,{status:'error',error:error.message})).catch(()=>{engine.record('native_operation_unavailable',id,{status:'error'});});
    return {job:key};
  }
  if(method==='setup'){
    if(p.allowInline!==undefined)await engine.command({action:'set-inline-questions',value:p.allowInline});
    else if(p.presentation!==undefined)await engine.command({action:'set-presentation',value:p.presentation});
    await engine.command({action:'save-learner-profile',value:p.profile});
    await engine.command({action:'set-limits',value:p.limits});
    await engine.command({action:'enable'});
    mode.completeSetup();revision++;
    return {...engine.snapshot(id),setup:mode.read().setup};
  }
  if (method === "job") {
    const j = jobs.get(p.job);
    if (!j || j.chatId !== id) throw Error("Learning operation is unavailable");
    return { status: j.status, result: j.result, error: j.error };
  }
  if (method === "command") {
    const input = p.input;
    if (!isNativeCommand(input.action)) throw Error("Unsupported learning action");
    if (input.sessionID && input.sessionID !== id) throw Error("Chat identity mismatch");
    if(input.action==='suggest')requireWorkContext(engine.snapshot(id).session);
    if (["enable", "disable", "stop"].includes(input.action)) mode.set(input.action === "enable");
    const key = crypto.randomUUID();
    await jobs.create(key,id);
    void (async()=>{if(input.action==='new-moment'){try{await ensureSession(id);await observer(id).poll();}catch(error){await engine.fail(error,id);throw error;}}return engine.command({ ...input, sessionID: id });})().then((result) => jobs.settle(key, { status: "ready", result })).catch((e) => jobs.settle(key, { status: "error", error: e.message })).catch(()=>{engine.record('native_operation_unavailable',id,{status:'error'});});
    return { job: key };
  }
  throw Error("Unsupported runtime method");
}
const server = createServer({ allowHalfOpen: true }, (socket) => {
  let raw = "";
  socket.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 52e5) socket.destroy();
  });
  socket.on("end", () => {
    void replyToSocket(socket,async()=>{
      const p=JSON.parse(raw);
      return handle(p.method,p.params||{});
    });
  });
});
server.listen(socketPath, () => void chmod(socketPath, 384));
const observationFailures=new Map();
const selectWatches=createWatchSelector();
let polling = false;
const timer = setInterval(async () => {
  if (polling || !ready) return;
  polling = true;
  try {
    const on = mode.read().on;
    if (on !== engine.state.enabled) await engine.command({ action: on ? "enable" : "disable" });
    if (on) {
      const files = (await readdir(chainDirectory)).filter((x) => /^watch-[0-9a-f-]{36}\.json$/i.test(x));
      const watches=[];
      for(const file of files){try{const watch=JSON.parse(await readFile(join(chainDirectory,file),"utf8"));if(validSessionId(watch.id)&&file===`watch-${watch.id}.json`)watches.push(watch);}catch{}}
      for (const watch of selectWatches(watches)) {
       const file=`watch-${watch.id}.json`;
       try {
        if (Date.now() - watch.at > 18e4) continue;
        const id = watch.id;
        if (!validSessionId(id) || file !== "watch-" + id + ".json") continue;
        await ensureSession(id);
        await observer(id).poll();
        syncInvitation(id);
       } catch {
        const last=observationFailures.get(file)||0;
        if(Date.now()-last>30000){
         observationFailures.set(file,Date.now());
         engine.record('native_observation_unavailable',file.slice(6,-5),{host:hostID,status:'retrying'});
        }
       }
      }
    }
  } catch (e) {
    process.stderr.write("Learning observation temporarily unavailable\n");
  } finally {
    polling = false;
  }
}, 2e3);
setInterval(() => {
  if (Date.now() - lastLease > 6e4 && !engine?.inflight?.size) {
    clearInterval(timer);
    server.close();
    void host?.close();
    void storage.close().finally(() => process.exit(0));
  }
}, 1e4);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  server.close();
  host?.close();
  analytics?.close();
  await storage.close().catch(() => {
  });
  await unlink(socketPath).catch(() => {
  });
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
