// Native action-only settings. Host renders referenced MCP Apps in a modal.
// https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#structured-settings
export const settingsCapability=Object.freeze({readTool:'read_plugin_settings',updateTool:'update_plugin_settings'});
export const settingsExtensions=Object.freeze({'openai/settings':settingsCapability});
const emptyObject={type:'object',properties:{},additionalProperties:false};
const valuesOutput={type:'object',properties:{values:emptyObject},required:['values'],additionalProperties:false};
export const settingsTools=[
 {name:settingsCapability.readTool,title:'LearningHarness settings actions',description:'Read the native plugin settings actions. This does not open a view or change learning.',inputSchema:emptyObject,outputSchema:{type:'object',properties:{schema:{type:'object'},values:emptyObject,layout:{type:'array',items:{type:'object'}}},required:['schema','values','layout'],additionalProperties:false},annotations:{readOnlyHint:true},_meta:{ui:{visibility:['app']}}},
 {name:settingsCapability.updateTool,title:'LearningHarness settings compatibility',description:'Accept an empty settings update. Learning preferences are managed in the full settings view.',inputSchema:{type:'object',properties:{set:emptyObject},required:['set'],additionalProperties:false},outputSchema:valuesOutput,annotations:{readOnlyHint:true},_meta:{ui:{visibility:['app']}}}
];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const empty=value=>object(value)&&Reflect.ownKeys(value).length===0;
export function settingsCall(name,args={}){
 if(name===settingsCapability.readTool){
  if(!empty(args))throw Error('Settings read accepts only empty arguments.');
  return {content:[],structuredContent:{schema:{type:'object',properties:{}},values:{},layout:[{kind:'group',title:'LearningHarness',items:[{kind:'tool',tool:'open_learning_journey'},{kind:'tool',tool:'open_global_settings'}]}]}};
 }
 if(name===settingsCapability.updateTool){
  if(!object(args)||Reflect.ownKeys(args).length!==1||!Object.hasOwn(args,'set')||!empty(args.set))throw Error('Settings actions do not accept property updates. Open LearningHarness settings.');
  return {content:[],structuredContent:{values:{}}};
 }
 throw Error('Unknown native settings request.');
}
