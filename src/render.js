import Handlebars from 'handlebars';

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
