// Codex's structured output uses required nullable fields for optional JSON
// properties. Execution still validates the ordinary (non-nullable) registry.
function strict(schema){
 const copy=structuredClone(schema);
 if(copy.type==='object'){
  const required=new Set(copy.required??[]);
  copy.properties=Object.fromEntries(Object.entries(copy.properties??{}).map(([key,value])=>[key,required.has(key)?strict(value):{anyOf:[strict(value),{type:'null'}]}]));
  copy.required=Object.keys(copy.properties);copy.additionalProperties=false;
 }
 if(copy.items)copy.items=strict(copy.items);
 return copy;
}
export function preparationResponseSchema(registry){
 const available=registry.describe(),teaching=available.some(tool=>tool.name==='teach');
 const tools=available.filter(tool=>[teaching?'teach':'present_flashcard','retrieve_work','retrieve_learner','stay_silent'].includes(tool.name));
 // Nest the discriminated union: each name is inseparable from its own input.
 // Independent tool/input enums permit teach + retrieve_work's {ids:[]}.
 return{type:'object',additionalProperties:false,required:['call'],properties:{call:{anyOf:tools.map(tool=>({type:'object',additionalProperties:false,required:['tool','input','reason'],properties:{tool:{type:'string',enum:[tool.name]},reason:{type:'string',minLength:1,maxLength:160},input:strict(tool.inputSchema)}}))}}};
}
export function unwrapPreparedCall(choice,schema){
 if(!schema?.properties?.call||!choice||!Object.hasOwn(choice,'call'))return choice;
 if(Object.keys(choice).length!==1||!choice.call||typeof choice.call!=='object'||Array.isArray(choice.call))throw Error('Prepared output needs one call envelope');
 return choice.call;
}
export function omitOptionalNulls(value,schema){
 if(value&&schema?.type==='object'&&typeof value==='object'&&!Array.isArray(value))return Object.fromEntries(Object.entries(value).filter(([key,item])=>item!==null||(schema.required??[]).includes(key)||!schema.properties?.[key]).map(([key,item])=>[key,omitOptionalNulls(item,schema.properties?.[key])]));
 if(Array.isArray(value)&&schema?.type==='array')return value.map(item=>omitOptionalNulls(item,schema.items));
 return value;
}
