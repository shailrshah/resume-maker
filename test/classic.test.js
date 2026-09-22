import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderHtml, SECTION_NAMES } from '../src/render.js';
import { validateResume } from '../src/validate.js';
import { htmlToPdf, closeBrowser } from '../src/pdf.js';

after(closeBrowser);

const example = JSON.parse(await readFile(new URL('../examples/resume.json', import.meta.url), 'utf8'));

test('the example resume is valid and uses every section', () => {
  validateResume(example);
  for (const name of SECTION_NAMES) assert.ok(example[name], `example is missing ${name}`);
});

test('classic renders every section in order', async () => {
  const html = await renderHtml(example);
  const rendered = [...html.matchAll(/<section class="section section--(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(rendered, SECTION_NAMES);
});

test('classic renders the example resume on one page', async () => {
  const { pages } = await htmlToPdf(await renderHtml(example));
  assert.equal(pages, 1);
});
