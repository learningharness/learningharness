import { exactObject, nonEmptyString } from '../../protocol/src/validation.js';

const schemaKeys = new Set(['type', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum']);
function assertSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('Unsupported tool schema');
  if (Object.keys(schema).some(key => !schemaKeys.has(key)) || schema.type && !['object', 'string', 'array', 'boolean', 'number', 'integer'].includes(schema.type)) throw new Error('Unsupported tool schema keyword or type');
  for (const child of Object.values(schema.properties ?? {})) assertSchema(child);
  if (schema.items) assertSchema(schema.items);
}

// The supported JSON Schema subset is deliberately small and enforced, not just
// advertised to the model. Semantic validation belongs to the registered tool.
function validate(value, schema, path = '$.input') {
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path}: invalid value`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected object`);
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) exactObject(value, Object.keys(properties), schema.required ?? [], path);
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) throw new Error(`${path}: missing ${key}`);
    for (const [key, child] of Object.entries(properties)) if (Object.hasOwn(value, key)) validate(value[key], child, `${path}.${key}`);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? 4000)) throw new Error(`${path}: string bounds: expected length ${schema.minLength ?? 0}..${schema.maxLength ?? 4000}, received ${typeof value === 'string' ? value.length : typeof value}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? 20)) throw new Error(`${path}: invalid array bounds`);
    value.forEach((item, i) => validate(item, schema.items ?? {}, `${path}[${i}]`));
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${path}: expected boolean`);
  else if (['number', 'integer'].includes(schema.type) && (!Number.isFinite(value) || schema.type === 'integer' && !Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw new Error(`${path}: invalid number bounds`);
}
export class ToolRegistry {
  #tools = new Map();
  register(tool) {
    if (!/^[a-z][a-z0-9_]{0,60}$/.test(tool.name) || this.#tools.has(tool.name) || typeof tool.execute !== 'function' || !tool.description || !tool.inputSchema) throw new Error('Invalid or duplicate learning tool');
    assertSchema(tool.inputSchema);
    this.#tools.set(tool.name, tool); return this;
  }
  describe() { return [...this.#tools.values()].filter(t => t.available !== false).map(({ name, description, inputSchema, terminal = false }) => ({ name, description, inputSchema, terminal })); }
  prepareInput(name, value) {
    const tool = this.#tools.get(name);
    if (!tool || tool.available === false) throw new Error('Unknown or unavailable learning tool');
    const input = tool.normalizeInput ? tool.normalizeInput(structuredClone(value)) : structuredClone(value);
    validate(input, tool.inputSchema);
    return input;
  }
  async execute(choice, api) {
    exactObject(choice, ['tool', 'input', 'reason']); nonEmptyString(choice.reason, '$.reason', 400);
    const tool = this.#tools.get(choice.tool);
    if (!tool || tool.available === false) throw new Error('Unknown or unavailable learning tool');
    const input = this.prepareInput(choice.tool, choice.input);
    api.check(); const value = await tool.execute(structuredClone(input), api); api.check();
    return { terminal: tool.terminal === true, value };
  }
}
// A compact rendering of the same registered contract, never an execution bypass.
// Native function calling still receives the full schema; text-envelope workflows
// need field names/types/bounds, not repeated JSON-Schema boilerplate.
export function compactToolGuidance(tools){
 const signature=s=>{
  if(s.enum)return s.enum.map(x=>JSON.stringify(x)).join('|');
  if(s.type==='object'){if(!s.properties)return 'object';return '{'+Object.entries(s.properties).map(([key,value])=>key+((s.required??[]).includes(key)?'':'?')+':'+signature(value)).join(',')+'}';}
  if(s.type==='array')return `array[${s.minItems??0}..${s.maxItems??20}]<${signature(s.items??{})}>`;
  if(s.type==='string')return `string[${s.minLength??0}..${s.maxLength??4000}]`;
  if(['integer','number'].includes(s.type))return `${s.type}[${s.minimum??'-∞'}..${s.maximum??'∞'}]`;
  return s.type??'value';
 };
 return 'Only declared object fields are allowed; ? marks optional. String bounds are characters; array bounds are counts.\n'+tools.map(t=>`${t.name}${t.terminal?' [terminal]':''}: ${signature(t.inputSchema)}\n${t.description}`).join('\n');
}
