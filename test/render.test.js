import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { UserError } from '../src/errors.js';
import { buildViewModel, createHandlebars, listTemplates, renderHtml } from '../src/render.js';

const templatesDir = fileURLToPath(new URL('./fixtures/templates/', import.meta.url));

const full = {
  basics: { name: 'Jane Doe' },
  summary: 'Engineer.',
  skills: [{ category: 'Languages', items: ['Go'] }],
  experience: [{ company: 'Acme Corp' }],
  projects: [{ name: 'Widget' }],
  education: [{ institution: 'State University' }],
  certifications: [{ name: 'Cert' }],
};

const sectionNames = (vm) => vm.sections.map((s) => s.name);

function render(source, context = {}) {
  return createHandlebars().compile(source)(context);
}

describe('buildViewModel', () => {
  it('uses the default order when none is given', () => {
    assert.deepEqual(sectionNames(buildViewModel(full)),
      ['summary', 'skills', 'experience', 'projects', 'education', 'certifications']);
  });

  it('follows a custom order', () => {
    const vm = buildViewModel({ ...full, sections: ['education', 'experience', 'summary'] });
    assert.deepEqual(sectionNames(vm), ['education', 'experience', 'summary']);
  });

  it('hides sections that have content but are not listed', () => {
    const vm = buildViewModel({ ...full, sections: ['experience'] });
    assert.deepEqual(sectionNames(vm), ['experience']);
  });

  it('skips listed sections that are missing or empty', () => {
    const vm = buildViewModel({
      basics: { name: 'Jane Doe' },
      sections: ['summary', 'skills', 'experience', 'projects', 'education'],
      summary: '',
      skills: [],
      experience: [{ company: 'Acme Corp' }],
      education: null,
    });
    assert.deepEqual(sectionNames(vm), ['experience']);
  });

  it('passes section data, basics and paper through', () => {
    const vm = buildViewModel(full, { paper: 'a4' });
    assert.equal(vm.basics, full.basics);
    assert.equal(vm.sections[0].data, 'Engineer.');
    assert.equal(vm.paper, 'a4');
    assert.equal(buildViewModel(full).paper, 'letter');
  });
});

describe('md helper', () => {
  it('renders bold and italic', () => {
    assert.equal(render('{{md t}}', { t: 'a **b** *c* d' }), 'a <strong>b</strong> <em>c</em> d');
  });

  it('escapes HTML before applying markup', () => {
    assert.equal(render('{{md t}}', { t: '**<script>x</script>**' }),
      '<strong>&lt;script&gt;x&lt;/script&gt;</strong>');
    assert.equal(render('{{md t}}', { t: 'R&D "quoted" <b>' }), 'R&amp;D &quot;quoted&quot; &lt;b&gt;');
  });

  it('renders nothing for missing text', () => {
    assert.equal(render('{{md t}}'), '');
  });
});

describe('date helpers', () => {
  it('formats a single date', () => {
    assert.equal(render('{{date d}}', { d: '2024-03' }), 'March 2024');
    assert.equal(render('{{date d}}'), '');
  });

  const cases = [
    ['start and end', '{{dateRange s e}}', { s: '2020-06', e: '2022-09' }, 'June 2020 – September 2022'],
    ['start only, ongoing', '{{dateRange s e}}', { s: '2020-06' }, 'June 2020 – Present'],
    ['start only, not ongoing', '{{dateRange s e ongoing=false}}', { s: '2020-06' }, 'June 2020'],
    ['end only', '{{dateRange s e}}', { e: '2018-12' }, 'December 2018'],
    ['no dates', '{{dateRange s e}}', {}, ''],
    ['no dates, not ongoing', '{{dateRange s e ongoing=false}}', {}, ''],
  ];
  for (const [name, source, context, expected] of cases) {
    it(`dateRange: ${name}`, () => assert.equal(render(source, context), expected));
  }
});

describe('join helper', () => {
  it('joins with a comma by default and escapes items', () => {
    assert.equal(render('{{join l}}', { l: ['C++', '<T>', 'R&D'] }), 'C++, &lt;T&gt;, R&amp;D');
  });

  it('accepts a custom separator', () => {
    assert.equal(render('{{join l sep=" | "}}', { l: ['a', 'b'] }), 'a | b');
  });

  it('renders nothing for a missing list', () => {
    assert.equal(render('{{join l}}'), '');
  });
});

describe('renderHtml', () => {
  const resume = {
    basics: { name: 'Jane Doe' },
    summary: 'Builds **reliable** systems.',
    skills: [{ category: 'Languages', items: ['Go', 'Rust'] }],
    experience: [
      {
        company: 'Acme Corp', title: 'Engineer', start: '2020-06',
        teams: [{ name: 'Payments', start: '2022-09', highlights: ['Cut latency by **40%**.'] }],
      },
      { company: 'Globex', start: '2018-01', end: '2020-05', highlights: ['Shipped things.'] },
    ],
    projects: [{ name: 'Widget', start: '2024-01' }],
    education: [{ institution: 'State University', degree: 'MS (**GPA: 3.80**)', start: '2016-09', end: '2018-12' }],
    certifications: [{ name: 'Cert', issuer: 'Example Institute', date: '2024-03' }],
  };

  it('renders every section in order with the fixture template', async () => {
    const html = await renderHtml(resume, { template: 'minimal', templatesDir });
    const order = [...html.matchAll(/section--(\w+)/g)].map((m) => m[1]);
    assert.deepEqual(order, ['summary', 'skills', 'experience', 'projects', 'education', 'certifications']);
    assert.match(html, /<h1>Jane Doe<\/h1>/);
    assert.match(html, /Builds <strong>reliable<\/strong> systems\./);
    assert.match(html, /Go, Rust/);
    assert.match(html, /Payments September 2022 – Present/);
    assert.match(html, /Cut latency by <strong>40%<\/strong>/);
    assert.match(html, /January 2018 – May 2020/);
    assert.match(html, /Widget January 2024\s*</);
    assert.match(html, /MS \(<strong>GPA: 3\.80<\/strong>\)/);
    assert.match(html, /Cert · Example Institute March 2024/);
  });

  it('inlines relative CSS assets as data URIs and leaves no external references', async () => {
    const html = await renderHtml(resume, { template: 'minimal', templatesDir });
    const urls = [...html.matchAll(/url\(\s*['"]?([^'")]*)/g)].map((m) => m[1]);
    assert.equal(urls.length, 3);
    for (const url of urls) assert.match(url, /^data:/);
    assert.match(html, /url\("data:font\/woff2;base64,/);
    assert.match(html, /url\("data:image\/png;base64,iVBORw0KGgo/);
    assert.match(html, /url\("data:image\/gif;base64,R0lGODlhAQABAAAAACw="\)/);
    assert.doesNotMatch(html, /<link|<script|src=/);
  });

  it('appends the page size for the chosen paper', async () => {
    assert.match(await renderHtml(resume, { template: 'minimal', templatesDir }), /@page \{ size: letter; \}/);
    assert.match(await renderHtml(resume, { template: 'minimal', templatesDir, paper: 'a4' }), /@page \{ size: A4; \}/);
  });

  it('rejects a template missing a section partial', async () => {
    await assert.rejects(renderHtml(resume, { template: 'no-projects', templatesDir }), (err) => {
      assert.ok(err instanceof UserError);
      assert.equal(err.message, 'template "no-projects" has no partial for section "projects"');
      return true;
    });
  });

  it('checks every section partial even when the resume lacks that section', async () => {
    await assert.rejects(renderHtml({ basics: { name: 'Jane Doe' } }, { template: 'no-projects', templatesDir }), UserError);
  });

  it('rejects an unknown template and lists the available ones', async () => {
    await assert.rejects(renderHtml(resume, { template: 'fancy', templatesDir }), (err) => {
      assert.ok(err instanceof UserError);
      assert.equal(err.message, 'unknown template "fancy" (available: minimal, no-projects)');
      return true;
    });
  });

  it('lists templates sorted by name', async () => {
    assert.deepEqual(await listTemplates(templatesDir), ['minimal', 'no-projects']);
  });
});
