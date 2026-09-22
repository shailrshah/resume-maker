import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schema/resume.schema.json' with { type: 'json' };
import { UserError } from './errors.js';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const SECTION_NAMES = schema.$defs.sectionName.enum;

export function parseResume(text, file) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UserError(`${file}: invalid JSON — ${err.message}`);
  }
}

export function validateResume(data) {
  if (validate(data)) return;
  const lines = validate.errors.map(formatError).filter(Boolean);
  throw new UserError(lines.join('\n'));
}

function formatError(err) {
  const path = toPath(err.instancePath);
  const got = JSON.stringify(err.data);
  switch (err.keyword) {
    // The "then" branch reports its own "not" error; the wrapping "if" error adds nothing.
    case 'if':
      return null;
    case 'not':
      return line(path, 'an employer with "teams" cannot also have "tech" or "highlights"; move them into a team');
    case 'required':
      return line(join(path, err.params.missingProperty), 'required field is missing');
    case 'additionalProperties': {
      const key = err.params.additionalProperty;
      const suggestion = closest(key, Object.keys(err.parentSchema.properties ?? {}));
      return line(join(path, key), `unknown field${suggestion ? ` (did you mean "${suggestion}"?)` : ''}`);
    }
    case 'enum':
      if (err.parentSchema === schema.$defs.sectionName) {
        return line(path, `unknown section ${got} (allowed: ${SECTION_NAMES.join(', ')})`);
      }
      return line(path, `must be one of ${err.schema.map((v) => JSON.stringify(v)).join(', ')} (got ${got})`);
    case 'uniqueItems':
      return line(join(path, err.params.i), `duplicate of ${join(path, err.params.j)} (${JSON.stringify(err.data[err.params.i])})`);
    case 'pattern':
      if (err.parentSchema === schema.$defs.date) {
        return line(path, `must be a year-month date like "2024-03" (got ${got})`);
      }
      return line(path, `${err.message} (got ${got})`);
    case 'format':
      return line(path, `must be a valid ${err.params.format === 'uri' ? 'URL' : err.params.format} (got ${got})`);
    case 'type':
      return line(path, `must be ${article(err.params.type)} (got ${typeOf(err.data)})`);
    case 'minLength':
      return line(path, 'must not be empty');
    default:
      return line(path, err.message);
  }
}

function line(path, message) {
  return `✖ ${path || '(root)'}: ${message}`;
}

function toPath(pointer) {
  return pointer
    .split('/')
    .slice(1)
    .map((seg) => seg.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce(join, '');
}

function join(path, seg) {
  if (typeof seg === 'number' || /^\d+$/.test(seg)) return `${path}[${seg}]`;
  return path ? `${path}.${seg}` : seg;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function article(type) {
  return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

function closest(word, candidates) {
  let best = null;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const d = distance(word, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}
