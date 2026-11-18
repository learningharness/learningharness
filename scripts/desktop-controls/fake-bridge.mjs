// Native UI test fixture. No connection to Codex or learner state.
const action=process.argv[2];
const chats=[{id:'11111111-1111-4111-8111-111111111111',title:'Sample engine project',project:'Demo',paused:false}];
const result=action==='chats'?{enabled:false,chats}:action==='new-moment'?{job:'22222222-2222-4222-8222-222222222222'}:action==='job'?{status:'ready'}:{enabled:action==='on'};
console.log(JSON.stringify(result));
