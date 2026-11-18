const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: true });
export const dontDumbRpc = Object.freeze({
  id: 'dontdumb',
  methods: {
    status: { input: object({ sessionID: { type: 'string' } }), output: object() },
    command: { input: object({ action: { type: 'string' }, sessionID: { type: 'string' }, value: {} }, ['action']), output: object() }
  },
  events: { updated: { schema: object({ sessionID: { type: 'string' }, reason: { type: 'string' } }, ['reason']) } }
});
