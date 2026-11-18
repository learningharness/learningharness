// Content-free, local capability evidence. Never persist request bodies or IDs.
export function createDiagnostics(save=()=>{}) {
 const state={schemaVersion:1,uiAdvertised:null,launches:0,htmlReads:0,appRequests:0};
 return {observe(method,params={}) {
  const capabilities=method==='initialize'?params.capabilities:params._meta?.['io.modelcontextprotocol/clientCapabilities'];
  if(capabilities)state.uiAdvertised=!!capabilities.extensions?.['io.modelcontextprotocol/ui'];
  let changed=!!capabilities;
  if(method==='tools/call'&&['open_learn','open_global_settings'].includes(params.name)){state.launches++;changed=true;}
  if(method==='resources/read'&&params.uri?.startsWith('ui://')){state.htmlReads++;changed=true;}
  if(method==='tools/call'&&['native_status','native_setup','native_command','native_job'].includes(params.name)){state.appRequests++;changed=true;}
  if(changed)try{save({...state});}catch{} // Diagnostics must never affect coding or UI calls.
 },snapshot:()=>({...state})};
}
