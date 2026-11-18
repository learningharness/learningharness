const text=(value,max)=>typeof value==='string'?value.replace(/[\x00-\x1f]/g,' ').trim().slice(0,max):'';
export function validateProjectWork(value){
 if(!value||!/^project_[a-f0-9]{32}$/.test(value.projectKey??'')||!Number.isFinite(Date.parse(value.at)))throw Error('Invalid project work context');
 const item={id:text(value.id,240),projectKey:value.projectKey,project:text(value.project,120),sessionId:text(value.sessionId,200),taskId:text(value.taskId,200),title:text(value.title,160),task:text(value.task,600),at:value.at};
 if(!item.id||!item.task||!item.sessionId||!item.taskId)throw Error('Incomplete project work context');
 return item;
}
export function projectContext(data,context={}){
 const matches=item=>context.projectKey?item.projectKey===context.projectKey:!item.projectKey&&Boolean(context.project)&&item.project===context.project;
 return {name:context.project??'',priorWork:(data.workContexts??[]).filter(matches).slice(-4),practisedConcepts:(data.evidence??[]).filter(matches).slice(-6).map(e=>({objective:e.objective,sessionTitle:e.sessionTitle??'',lastAt:e.createdAt,verdict:e.verdict,assisted:e.assisted===true})),uncertainty:'Earlier tasks are observed requests, not proof that changes were implemented. Shared project membership is not proof of a dependency.'};
}
