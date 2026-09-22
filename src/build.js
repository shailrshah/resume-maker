import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UserError } from './errors.js';
import { htmlToPdf } from './pdf.js';
import { renderHtml } from './render.js';
import { parseResume, validateResume } from './validate.js';

export function defaultOutPath(input) {
  return path.join('out', `${path.basename(input, path.extname(input))}.pdf`);
}

export async function loadResume(input) {
  let text;
  try {
    text = await readFile(input, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new UserError(`${input}: file not found`);
    throw err;
  }
  const resume = parseResume(text, input);
  try {
    validateResume(resume);
  } catch (err) {
    if (err instanceof UserError) throw new UserError(`${input} is invalid:\n${err.message}`);
    throw err;
  }
  return resume;
}

export async function build(input, { template = 'classic', paper = 'letter', out = defaultOutPath(input) } = {}) {
  const resume = await loadResume(input);
  const { pdf, pages, type3Fonts } = await htmlToPdf(await renderHtml(resume, { template, paper }));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, pdf);
  return { out, pages, type3Fonts };
}
