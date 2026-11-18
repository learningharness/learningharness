// Illustrative protocol sequence; never a captured execution trace.
const actors=[['user','You',24],['harness','Agent',196],['model','Model',368],['tool','Plugin',540]];
const colors={user:'#b2a0ed',harness:'#75bee9',model:'#74d8b5',tool:'#eac18b'};
const scene=actors.map(([id,label,x])=>`<rect x="${x}" y="38" width="150" height="76" rx="13" fill="#22232e" stroke="#3b3b4d"/><circle cx="${Number(x)+75}" cy="20" r="4" fill="${colors[id]}"/><text x="${Number(x)+75}" y="83" fill="#eeedf6" text-anchor="middle" font-size="20" font-weight="500">${label}</text>`).join('');
function step(from,to,title,body,payload,color='#b1a3ff'){
 const a=actors.find(a=>a[0]===from),b=actors.find(a=>a[0]===to);const x1=Number(a[2])+75,x2=Number(b[2])+75;
 const path=`M${x1} 116 C${x1} 172 ${x2} 172 ${x2} 116`;
 return{title,body,overlay:`<rect x="${a[2]}" y="38" width="150" height="76" rx="13" fill="none" stroke="${color}" stroke-width="2"/><rect x="${b[2]}" y="38" width="150" height="76" rx="13" fill="none" stroke="${color}" stroke-width="2"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/><path d="M${x2-4} 122 L${x2} 115 L${x2+4} 122" fill="none" stroke="${color}" stroke-width="2"/><circle r="5" fill="#eeedf6"><animateMotion path="${path}" dur="1.4s" repeatCount="indefinite"/></circle><text x="360" y="200" text-anchor="middle" fill="#eeedf6" font-size="19">${a[1]} → ${b[1]}</text><text x="360" y="232" text-anchor="middle" fill="#aba8bd" font-size="16">${payload}</text>`};
}
export const messageFlowArtifact={format:'visual',title:'Follow a message',viewBox:'0 0 720 260',scene,scenarios:[{label:'A successful tool call',steps:[
 step('user','harness','Start with the request','The agent receives your request and prepares the working context.','Your request'),
 step('harness','model','Choose the next action','The model sees the request and the available tool definitions.','Request + context + tool definitions'),
 step('model','harness','Propose a tool call','The model proposes an action. The agent controls whether it runs.','Tool name + arguments'),
 step('harness','tool','Cross the tool boundary','The agent dispatches the permitted call to the plugin’s tool server.','Execute the tool'),
 step('tool','harness','Return the result','The plugin returns data to the agent; it does not become the model.','Tool result','#74d8b5'),
 step('harness','model','Make sense of the result','The agent supplies the result so the model can continue reasoning.','Context + tool result','#74d8b5'),
 step('harness','user','Show the response','The agent delivers the resulting response in your chat.','Visible response','#74d8b5')
]},{label:'The tool times out',steps:[
 step('model','harness','The model proposes a call','A proposed tool action is still distinct from a completed result.','Tool name + arguments'),
 step('harness','tool','Wait for a result','The request crosses the boundary, but the tool does not return in time.','Waiting…','#eac18b'),
 step('tool','harness','Handle the timeout','The agent receives a failure instead of inventing the missing result.','Timeout / failed result','#e99791'),
 step('harness','user','Make the failure visible','The response can explain the failure or offer another way forward.','A clear outcome','#e99791')
]}]};
