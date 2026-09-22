import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseResume, validateResume } from '../src/validate.js';
import { UserError } from '../src/errors.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fixture = (name) => parseResume(read(`fixtures/${name}.json`), `${name}.json`);

function errorLines(data) {
  try {
    validateResume(data);
  } catch (err) {
    assert.ok(err instanceof UserError);
    return err.message.split('\n');
  }
  assert.fail('expected validation to fail');
}

test('example resume is valid', () => {
  assert.doesNotThrow(() => validateResume(parseResume(read('../examples/resume.json'), 'resume.json')));
});

test('minimal resume with only a name is valid', () => {
  assert.doesNotThrow(() => validateResume({ basics: { name: 'Jane Doe' } }));
});

test('invalid JSON names the file', () => {
  assert.throws(() => fixture('invalid-syntax'), (err) => {
    assert.ok(err instanceof UserError);
    assert.match(err.message, /^invalid-syntax\.json: invalid JSON — /);
    return true;
  });
});

test('typo in a field name suggests the correct one', () => {
  assert.deepEqual(errorLines(fixture('typo-field')), [
    '✖ experience[1].highlight: unknown field (did you mean "highlights"?)',
  ]);
});

test('unknown field without a close match has no suggestion', () => {
  assert.deepEqual(errorLines({ basics: { name: 'Jane Doe', twitter: 'x' } }), [
    '✖ basics.twitter: unknown field',
  ]);
});

test('wrong type reports expected and actual type', () => {
  assert.deepEqual(errorLines(fixture('wrong-type')), ['✖ skills[0].items: must be an array (got string)']);
});

test('malformed date reports the nested path and value', () => {
  assert.deepEqual(errorLines(fixture('bad-date')), [
    '✖ experience[0].teams[1].start: must be a year-month date like "2024-03" (got "2024-3")',
  ]);
});

test('unknown section name lists the allowed names', () => {
  const [line, ...rest] = errorLines(fixture('unknown-section'));
  assert.deepEqual(rest, []);
  assert.match(line, /^✖ sections\[2\]: unknown section "project" \(allowed: summary, skills, experience, projects, /);
});

test('duplicate section name is rejected', () => {
  assert.deepEqual(errorLines(fixture('duplicate-section')), [
    '✖ sections[2]: duplicate of sections[0] ("summary")',
  ]);
});

test('employer cannot have both teams and direct highlights', () => {
  const [line, ...rest] = errorLines(fixture('teams-and-highlights'));
  assert.deepEqual(rest, []);
  assert.match(line, /^✖ experience\[0\]: an employer with "teams" cannot also have "tech" or "highlights"/);
});

test('missing required field, empty string and bad URL are all reported at once', () => {
  assert.deepEqual(
    errorLines({ basics: { name: '' }, projects: [{ name: 'x', url: 'not a url' }], certifications: [{}] }),
    [
      '✖ basics.name: must not be empty',
      '✖ projects[0].url: must be a valid URL (got "not a url")',
      '✖ certifications[0].name: required field is missing',
    ],
  );
});

test('missing basics is reported at the root', () => {
  assert.deepEqual(errorLines({}), ['✖ basics: required field is missing']);
});
