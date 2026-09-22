import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function run(...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [cli, ...args], (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, stdout, stderr });
    });
  });
}

test('build writes a PDF and exits 0', async () => {
  const out = path.join(await mkdtemp(path.join(tmpdir(), 'resume-')), 'nested', 'resume.pdf');
  const { code, stdout } = await run('build', 'examples/resume.json', '-o', out);
  assert.equal(code, 0);
  assert.match(stdout, /✔ built .*resume\.pdf \(1 page, \d+ ms\)/);
  await access(out);
});

test('validate reports schema errors with the input path and exits 1', async () => {
  const { code, stderr } = await run('validate', 'test/fixtures/bad-date.json');
  assert.equal(code, 1);
  assert.match(stderr, /^test\/fixtures\/bad-date\.json is invalid:\n✖ experience\[0\]\.teams\[1\]\.start: /);
});

test('an invalid build writes no file', async () => {
  const out = path.join(await mkdtemp(path.join(tmpdir(), 'resume-')), 'bad.pdf');
  const { code } = await run('build', 'test/fixtures/typo-field.json', '-o', out);
  assert.equal(code, 1);
  await assert.rejects(access(out));
});

test('user errors exit 1 without a stack trace', async () => {
  for (const args of [
    ['build', 'missing.json'],
    ['build', 'examples/resume.json', '-t', 'nope'],
    ['build', 'examples/resume.json', '--paper', 'legal'],
    ['build', 'examples/resume.json', '--bogus'],
    ['frob'],
  ]) {
    const { code, stderr } = await run(...args);
    assert.equal(code, 1, args.join(' '));
    assert.doesNotMatch(stderr, /\n\s+at /, args.join(' '));
  }
});
