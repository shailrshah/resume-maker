import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { htmlToPdf, closeBrowser } from '../src/pdf.js';

after(closeBrowser);

const page = (body, size = 'letter') =>
  `<!doctype html><html><head><style>@page { size: ${size}; margin: 0.5in; }</style></head><body>${body}</body></html>`;

test('short content fits on one page', async () => {
  const { pages } = await htmlToPdf(page('<p>Hello</p>'));
  assert.equal(pages, 1);
});

test('long content spills onto more pages', async () => {
  const { pages } = await htmlToPdf(page('<p>Line</p>'.repeat(200)));
  assert.ok(pages > 1, `expected > 1 page, got ${pages}`);
});

test('page size follows the @page rule', async () => {
  const sizeOf = async (size) => {
    const doc = await PDFDocument.load((await htmlToPdf(page('<p>x</p>', size))).pdf);
    const { width, height } = doc.getPage(0).getSize();
    return [Math.round(width), Math.round(height)];
  };
  assert.deepEqual(await sizeOf('letter'), [612, 792]);
  assert.deepEqual(await sizeOf('A4'), [595, 842]);
});

test('links stay clickable', async () => {
  const { pdf } = await htmlToPdf(page('<a href="https://example.com/">example</a>'));
  const doc = await PDFDocument.load(pdf);
  const annots = doc.getPage(0).node.Annots();
  assert.ok(annots, 'page has no annotations');
  const uris = annots.asArray().map((ref) => {
    const action = doc.context.lookup(doc.context.lookup(ref).get(PDFName.of('A')));
    return action?.get(PDFName.of('URI'))?.decodeText();
  });
  assert.ok(uris.includes('https://example.com/'), `links found: ${uris}`);
});

test('counts Type 3 fonts, which Chromium uses for CFF-outline fonts', async () => {
  const withFont = async (file, format) => {
    const data = (await readFile(new URL(file, import.meta.url))).toString('base64');
    const face = `@font-face { font-family: F; src: url(data:font/${format};base64,${data}); }`;
    return htmlToPdf(page(`<style>${face}</style><p style="font-family: F">Hello</p>`));
  };
  assert.ok((await withFont('./fixtures/fonts/cff.otf', 'otf')).type3Fonts > 0);
  assert.equal((await withFont('../templates/classic/fonts/carlito-latin-400-normal.woff2', 'woff2')).type3Fonts, 0);
});
