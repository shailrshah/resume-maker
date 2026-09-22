import { chromium } from 'playwright';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

let browserPromise;

function getBrowser() {
  browserPromise ??= chromium.launch();
  return browserPromise;
}

export async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
    const doc = await PDFDocument.load(pdf);
    return { pdf, pages: doc.getPageCount(), type3Fonts: countType3Fonts(doc) };
  } finally {
    await page.close();
  }
}

// Chromium embeds CFF-outline fonts, including system fonts it falls back to for
// characters a template's fonts lack, as Type 3, which text extractors misread.
function countType3Fonts(doc) {
  return doc.context.enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type3'))
    .length;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser.close();
}
