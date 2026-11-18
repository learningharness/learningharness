export class ProtocolError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
    this.path = path;
  }
}

export function exactObject(value, allowed, required = allowed, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProtocolError('INVALID_TYPE', 'expected object', path);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new ProtocolError('UNKNOWN_KEY', `unknown key ${key}`, `${path}.${key}`);
  for (const key of required) if (!(key in value)) throw new ProtocolError('MISSING_KEY', `missing key ${key}`, `${path}.${key}`);
  return value;
}

export function nonEmptyString(value, path, max = 4096) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new ProtocolError('INVALID_STRING', `expected 1-${max} characters`, path);
  return value;
}

export function oneOf(value, values, path) {
  if (!values.includes(value)) throw new ProtocolError('INVALID_ENUM', `expected one of ${values.join(', ')}`, path);
  return value;
}
