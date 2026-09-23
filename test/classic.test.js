import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
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

test('classic embeds no Type 3 fonts, which text extractors misread', async () => {
  const { type3Fonts } = await htmlToPdf(await renderHtml(example));
  assert.equal(type3Fonts, 0);
});

async function extractLines() {
  const { pdf } = await htmlToPdf(await renderHtml(example));
  const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const { items } = await (await doc.getPage(1)).getTextContent();
  return items.map((item) => item.str + (item.hasEOL ? '\n' : '')).join('').split('\n');
}

test('classic headings and name extract as whole words', async () => {
  const lines = await extractLines();
  for (const expected of [example.basics.name, 'TECHNICAL SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS']) {
    assert.ok(lines.includes(expected), `"${expected}" not found as a line in extracted text`);
  }
});

test('classic keeps bullets in reading order under their entry', async () => {
  const lines = await extractLines();
  const indexOf = (text) => lines.findIndex((line) => line.startsWith(text));
  const plain = (text) => text.replace(/\*/g, '').slice(0, 30);
  const [first, second] = example.experience;
  const bullet = indexOf(plain(first.teams[0].highlights[0]));
  assert.ok(indexOf(first.company) < bullet && bullet < indexOf(second.company), 'first bullet is not under its employer');
  const lastProjectBullet = indexOf(plain(example.projects.at(-1).highlights.at(-1)));
  assert.ok(lastProjectBullet > 0 && lastProjectBullet < lines.indexOf('EDUCATION'), 'project bullet is not before Education');
});
