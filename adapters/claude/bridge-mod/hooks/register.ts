import type { Register } from 'claude-code'

type Job = {id:string;sessionId:string;model:string|null;system:string;prompt:string;maxTokens?:number;effort?:'low'|'medium'|'high'|'max';timeoutMs?:number}

// Native subscription broker only. No tools, transcript access or credentials
// leave the coding session. Heartbeats must never wait for model completion.
export function register(on: Parameters<Register>[0]) {
  const stops = new Map<string, () => void>()
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const home = await $.env.get('HOME')
    if (!home) return started
    const state = await $.env.get('LEARNING_HARNESS_STATE_DIR') || await $.env.get('DONTDUMB_STATE_DIR')
    const native = await $.env.get('LEARNING_HARNESS_NATIVE')
    const socketPath = (state || home + (native === '1' ? '/.local/share/learning-harness/claude' : '/.local/share/learning-harness/companion/claude')) + '/bridge-v2.sock'
    const sessionId = await $.session.id()
    const workerId = crypto.randomUUID()
    const cwd = await $.session.cwd()
    let polling = false, stopped = false
    let active: {id:string;controller:AbortController}|null = null
    const post = (path:string, body:object) => $.http.fetch('http://bridge/v2/' + path, {
      socketPath,method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({version:2,sessionId,workerId,...body}),
    })
    const run = async (job:Job) => {
      const controller = new AbortController()
      active = {id:job.id,controller}
      try {
        const answer = await $.model.complete({model:job.model || await $.session.model(),system:job.system,prompt:job.prompt,maxTokens:job.maxTokens,effort:job.effort,timeoutMs:job.timeoutMs}, {signal:controller.signal})
        if (!stopped && !controller.signal.aborted) await post('result', answer.isAnswered
          ? {id:job.id,isAnswered:true,text:answer.text,usage:answer.usage}
          : {id:job.id,isAnswered:false,reason:answer.reason})
      } catch {
        if (!stopped && !controller.signal.aborted) await post('result',{id:job.id,isAnswered:false,reason:'bridge_error'}).catch(()=>{})
      } finally { if (active?.id === job.id) active = null }
    }
    const poll = async () => {
      if (polling || stopped) return
      polling = true
      try {
        const auth = (await $.session.authorize())?.kind ?? 'none'
        const response = await post('poll',{auth,cwd,model:await $.session.model(),activeJobId:active?.id ?? null})
        if (response.status !== 200) { active?.controller.abort(); return }
        const body = JSON.parse(response.text) as {job?:Job;cancel?:string}
        if (body.cancel === active?.id) active?.controller.abort()
        if (body.job && body.job.sessionId === sessionId && !active) void run(body.job)
      } catch { active?.controller.abort() }
      finally { polling = false }
    }
    const timer = $.clock.every(1000, () => void poll())
    stops.get(sessionId)?.()
    stops.set(sessionId,()=>{stopped=true;timer.cancel();active?.controller.abort()})
    void poll()
    return started
  })
  on('session.end', async ($,e,next)=>{
    const id=await $.session.id();stops.get(id)?.();stops.delete(id)
    return next(e)
  })
}
