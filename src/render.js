import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { UserError } from './errors.js';

const DEFAULT_TEMPLATES_DIR = fileURLToPath(new URL('../templates/', import.meta.url));

export const SECTION_NAMES = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];

// Hard-coded instead of Intl so output never depends on the machine's locale.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function buildViewModel(resume, { paper = 'letter' } = {}) {
  const order = resume.sections ?? SECTION_NAMES;
  return {
    basics: resume.basics,
    sections: order
      .filter((name) => !isEmpty(resume[name]))
      .map((name) => ({ name, data: resume[name] })),
    paper,
  };
}

export function formatDate(yearMonth) {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

export function formatDateRange(start, end, { ongoing = true } = {}) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return ongoing ? `${formatDate(start)} – Present` : formatDate(start);
  return formatDate(end);
}

export function createHandlebars() {
  const hbs = Handlebars.create();
  const { escapeExpression, SafeString } = hbs;

  hbs.registerHelper('md', (text) => {
    if (text == null) return '';
    // Escape before applying markup so content can never inject HTML.
    const html = escapeExpression(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    return new SafeString(html);
  });
  hbs.registerHelper('date', (yearMonth) => formatDate(yearMonth));
  hbs.registerHelper('dateRange', (start, end, options) =>
    formatDateRange(start, end, { ongoing: options.hash.ongoing ?? true }));
  hbs.registerHelper('join', (list, options) => {
    if (!Array.isArray(list)) return '';
    const sep = options.hash.sep ?? ', ';
    return new SafeString(list.map((item) => escapeExpression(item)).join(escapeExpression(sep)));
  });

  return hbs;
}

const MIME_TYPES = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export async function listTemplates(templatesDir = DEFAULT_TEMPLATES_DIR) {
  try {
    const entries = await readdir(templatesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function readTemplateFile(template, dir, file, encoding) {
  try {
    return await readFile(path.join(dir, file), encoding);
  } catch (err) {
    if (err.code === 'ENOENT') throw new UserError(`template "${template}" is missing ${file}`);
    throw err;
  }
}

async function registerPartials(hbs, template, dir) {
  const partialsDir = path.join(dir, 'partials');
  const files = (await readdir(partialsDir).catch(() => [])).filter((f) => f.endsWith('.hbs'));
  for (const file of files) {
    hbs.registerPartial(path.basename(file, '.hbs'), await readFile(path.join(partialsDir, file), 'utf8'));
  }
  const missing = SECTION_NAMES.find((name) => !hbs.partials[name]);
  if (missing) throw new UserError(`template "${template}" has no partial for section "${missing}"`);
}

// Assets become data URIs because Chromium's setContent page (about:blank) can't
// load relative file paths, and a font that fails to load would silently fall back.
async function inlineCss(template, dir) {
  const css = await readTemplateFile(template, dir, 'style.css', 'utf8');
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
  const dataUris = new Map();
  for (const [, , ref] of css.matchAll(urlPattern)) {
    if (dataUris.has(ref) || /^(data:|https?:)/i.test(ref)) continue;
    const mime = MIME_TYPES[path.extname(ref).toLowerCase()] ?? 'application/octet-stream';
    const bytes = await readTemplateFile(template, dir, ref);
    dataUris.set(ref, `data:${mime};base64,${bytes.toString('base64')}`);
  }
  return css.replace(urlPattern, (match, _quote, ref) => (dataUris.has(ref) ? `url("${dataUris.get(ref)}")` : match));
}

export async function renderHtml(resume, { template = 'classic', paper = 'letter', templatesDir = DEFAULT_TEMPLATES_DIR } = {}) {
  const available = await listTemplates(templatesDir);
  if (!available.includes(template)) {
    throw new UserError(`unknown template "${template}" (available: ${available.join(', ') || 'none'})`);
  }
  const dir = path.join(templatesDir, template);
  const hbs = createHandlebars();
  await registerPartials(hbs, template, dir);
  const page = hbs.compile(await readTemplateFile(template, dir, 'template.hbs', 'utf8'));
  const styles = `${await inlineCss(template, dir)}\n@page { size: ${paper === 'a4' ? 'A4' : 'letter'}; }\n`;
  return page({ ...buildViewModel(resume, { paper }), styles });
}
