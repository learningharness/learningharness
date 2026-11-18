const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Flashcard content exceeds bounds');return value.trim();};
export function flashcardDeck(cards){
 if(!Array.isArray(cards)||cards.length<2||cards.length>12)throw Error('A flashcard deck needs 2–12 cards');
 return {position:0,revealed:[],ratings:{},cards:cards.map((card,index)=>({id:`card-${index+1}`,front:text(card.front,200),back:text(card.back,800),objective:text(card.objective,160)}))};
}
export function publicLearningMoment(moment){
 const safe=structuredClone(moment);delete safe.learningDesign;delete safe.rubric;delete safe.correctAnswer;delete safe.quizExplanation;
 if(safe.entryMode==='prediction'&&!safe.explanationRevealed&&!safe.completed){safe.body='';for(const key of ['lesson','comparison','experiment','visual','mindMap','mindMapText','artifact','hook','relevance','sibling','deeper'])delete safe[key];}
 if(safe.deck)for(const card of safe.deck.cards)if(!safe.deck.revealed.includes(card.id))delete card.back;
 return safe;
}
