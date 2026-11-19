// Inline is a bounded question projection, never another copy of the app.
export function quickQuestion(moment){
 if(!moment?.id||!['predict','multiple_choice'].includes(moment.kind)||moment.experiment||moment.mindMap||moment.contrast)return null;
 const question=typeof moment.question==='string'?moment.question.trim():'';if(!question||question.length>240)return null;
 const choices=moment.choices??[];
 if(!Array.isArray(choices)||choices.length>4||choices.some(value=>typeof value!=='string'||value.length>160)||moment.kind==='multiple_choice'&&choices.length<2)return null;
 const context=typeof moment.body==='string'?moment.body.trim():'';if(context.length>280)return null;
 return {id:moment.id,kind:moment.kind,title:moment.title,question,choices,context};
}
