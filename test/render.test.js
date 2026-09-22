import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildViewModel, createHandlebars } from '../src/render.js';

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
