import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

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
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    return { pdf, pages };
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser.close();
}
