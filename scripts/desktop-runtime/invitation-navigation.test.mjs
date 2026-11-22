import test from 'node:test';
import assert from 'node:assert/strict';
import {openInvitation,isExpandedInvitation,invitationLabel} from './web/invitation-navigation.js';

test('the text entry uses the current opportunity title and a safe bounded fallback',()=>{
 assert.equal(invitationLabel({session:{goals:{list:[{outcome:'Understand auth token expiry'}]}}}),'Understand auth token expiry');
 assert.equal(invitationLabel({session:{upcomingGoals:{list:[{outcome:'Explore session revocation'}]},goals:{list:[{outcome:'Old topic'}]}}}),'Explore session revocation');
 assert.equal(invitationLabel({session:{goals:{list:[{outcome:'  Learn\n about auth  '}]}}}),'Learn about auth');
 for(const value of [undefined,{}, {session:{goals:{list:[]}}},{session:{goals:{list:[{outcome:{html:'bad'}}]}}}])assert.equal(invitationLabel(value),'Open learning opportunity');
 assert.ok(invitationLabel({session:{goals:{list:[{outcome:'a'.repeat(1000)}]}}}).length<=120);
});

test('a stale or missing invitation cannot block opening Learn',async()=>{
 const actions=[];
 await openInvitation({requestDisplay:async()=>actions.push('expand'),openLearn:()=>actions.push('learn'),recordOpened:async()=>{actions.push('record');throw Error('No prepared opportunity is ready for this chat');}});
 assert.deepEqual(actions,['expand','learn','record']);
});
test('an unresponsive click receipt does not delay navigation; host display failure remains visible',async()=>{
 let opened=false;
 await openInvitation({requestDisplay:async()=>{},openLearn:()=>{opened=true;},recordOpened:()=>new Promise(()=>{})});
 assert.equal(opened,true);
 opened=false;
 await assert.rejects(openInvitation({requestDisplay:async()=>{throw Error('Cannot expand');},openLearn:()=>{opened=true;},recordOpened:async()=>{}}),/Cannot expand/);
 assert.equal(opened,false);
});
test('an invitation resource mounted in the expanded panel renders Learn directly',()=>{
 assert.equal(isExpandedInvitation({displayMode:'fullscreen'}),true);
 for(const context of [undefined,{}, {displayMode:'inline'}])assert.equal(isExpandedInvitation(context),false);
});

test('due reviews use their concept title in the compact invitation',()=>{
 assert.equal(invitationLabel({session:{reviewOffer:{objective:'Session cookie scope'}}}),'Revisit Session cookie scope');
});

test('opening a separate lesson view does not enlarge the original inline invitation',async()=>{
 const {shouldExpandInvitation}=await import('./web/invitation-navigation.js');
 assert.equal(shouldExpandInvitation({}, {requested:true}),false,'an acknowledged request is not evidence that this frame expanded');
 assert.equal(shouldExpandInvitation({mode:'fullscreen'}, {requested:true}),false,'a request result may describe a separate frame');
 assert.equal(shouldExpandInvitation({displayMode:'fullscreen'}, {previousMode:'inline'}),true);
 assert.equal(shouldExpandInvitation({displayMode:'fullscreen'}, {}),false,'initial default is not a transition');
 assert.equal(shouldExpandInvitation({displayMode:'inline'}, {requested:true}),false);
});


test('closing fullscreen restores only the link, and late expansion acknowledgments cannot reopen it',async()=>{
 const {invitationModeAfterHostChange,shouldExpandInvitation}=await import('./web/invitation-navigation.js');
 assert.equal(invitationModeAfterHostChange(false,{displayMode:'inline'}),true);
 assert.equal(invitationModeAfterHostChange(true,{displayMode:'fullscreen'},{requested:true}),false);
 assert.equal(shouldExpandInvitation({mode:'fullscreen'},{requested:true,requestVersion:0,contextVersion:1}),false);
});
test('a fullscreen request result never promotes the original transcript frame',async()=>{
 const {shouldExpandInvitation}=await import('./web/invitation-navigation.js');
 assert.equal(shouldExpandInvitation({mode:'fullscreen'},{requested:true}),false);
});
test('request replies cannot change placement, but real same-frame context changes can',async()=>{
 const {inlineFrameAfterContext}=await import('./web/invitation-navigation.js');
 for(const displayMode of ['inline','fullscreen',undefined])assert.equal(inlineFrameAfterContext(true,{displayMode},{source:'request-result'}),true);
 assert.equal(inlineFrameAfterContext(true,{displayMode:'fullscreen'}),false);
 assert.equal(inlineFrameAfterContext(false,{displayMode:'inline'}),true);
});
test('only ready enabled inline questions open automatically, never full experiences or sidebar frames',async()=>{
 const {shouldAutoOpenQuickQuestion}=await import('./web/invitation-navigation.js');
 const ready={invitation:true,inlineFrame:true,inlineEligible:true,allowInline:true,enabled:true,paused:false,globallyStopped:false,pendingExpansion:false};
 assert.equal(shouldAutoOpenQuickQuestion(ready),true);
 for(const change of [{invitation:false},{inlineFrame:false},{inlineEligible:false},{inlineEligible:undefined},{allowInline:false},{enabled:false},{paused:true},{globallyStopped:true},{pendingExpansion:true}])assert.equal(shouldAutoOpenQuickQuestion({...ready,...change}),false,JSON.stringify(change));
});
