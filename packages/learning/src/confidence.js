export function learnerConfidence(value){
 if(value==null)return null;
 if(!['low','medium','high'].includes(value))throw Error('Choose low, medium or high confidence');
 return value;
}
export function calibration(verdict,confidence){
 if(!confidence)return 'not_reported';
 if(verdict==='partial')return confidence==='high'?'confident_gap':'uncertain_gap';
 if(verdict==='correct')return confidence==='low'?'uncertain_correct':confidence==='high'?'confident_correct':'correct_medium_confidence';
 return confidence==='high'?'confident_error':'uncertain_error';
}
