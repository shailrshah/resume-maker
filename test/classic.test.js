import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
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
  const doc = await PDFDocument.load((await htmlToPdf(await renderHtml(example))).pdf);
  const subtypes = doc.context.enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Font'))
    .map(([, font]) => font.get(PDFName.of('Subtype')).toString());
  assert.ok(subtypes.length > 0);
  assert.ok(!subtypes.includes('/Type3'), `found fonts: ${subtypes.join(', ')}`);
});
