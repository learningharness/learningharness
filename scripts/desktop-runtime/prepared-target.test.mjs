import test from 'node:test';import assert from 'node:assert/strict';
import {restorePreparedMoment} from './prepared-target.mjs';
test('an invitation control turn can restore exact saved teaching without inference',()=>{
 const chain={status:'stale',runtimeKey:null,preparedTarget:{id:'card',kind:'moment',momentId:'m'}},session={moment:{id:'m'},preparedLessons:{card:{moment:{id:'m'}}}},mode={enabled:true};
 assert.equal(restorePreparedMoment(chain,session,mode,10).runtimeKey,'moment:m');assert.equal(chain.status,'stale');
 for(const other of [{...session,paused:true},{...session,moment:{id:'different'}},{...session,moment:{id:'m',completed:true}},{...session,preparedLessons:{}}])assert.equal(restorePreparedMoment(chain,other,mode),null);
 for(const state of [{enabled:false},{enabled:true,globallyStopped:true}])assert.equal(restorePreparedMoment(chain,session,state),null);
 assert.equal(restorePreparedMoment({...chain,preparedTarget:{...chain.preparedTarget,kind:'goal'}},session,mode),null);
});
