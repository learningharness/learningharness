const short=text=>String(text??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,120);
export function explorationLabel(move,moment={}){
 const topic=short(moment.objective??moment.title);
 if(move.id==='dig-deeper')return moment.deeper?.trim()?short(moment.deeper):topic?`Go deeper into ${topic}`:move.label;
 if(move.id==='zoom-out'&&moment.sibling?.trim())return short(moment.sibling);
 if(move.id==='easier')return topic?`Try a simpler example of ${topic}`:move.label;
 if(move.id==='continue')return topic?`Keep exploring ${topic}`:move.label;
 return move.label;
}
export function navigationGroups(moves,moment={},feedback,{practiceOpen=true}={}){
 if(moment.lesson&&!feedback&&!practiceOpen)moves=moves.filter(move=>!['hint','hint-after','easier','show-code'].includes(move.id));
 const primary=moves.find(m=>m.id==='adaptive-next')??((moment.question&&!feedback&&(!moment.lesson||practiceOpen)||moment.orientation)?moves[0]:null);
 const toolMoves=new Set(['quiz-me','try-it','see-how-it-works']);
 return {primary:primary&&!toolMoves.has(primary.id)?primary:null,explorations:moves.filter(m=>m!==primary&&!toolMoves.has(m.id)).map(m=>({...m,label:explorationLabel(m,moment)}))};
}
