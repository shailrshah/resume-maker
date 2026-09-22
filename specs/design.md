# Resume Maker — Design

Implements [`requirements.md`](./requirements.md). Requirement IDs (FR-n, NFR-n, AC-n) refer to that document.

## 1. Architecture

```
            ┌──────────┐   ┌───────────┐   ┌────────────┐   ┌───────────┐
input.json ─► load     ├──►│ validate  ├──►│ render     ├──►│ pdf       ├─► out/<name>.pdf
            │ (parse)  │   │ (Ajv +    │   │ (view      │   │ (HTML →   │
            └──────────┘   │  schema)  │   │  model +   │   │  PDF via  │
                           └───────────┘   │  Handlebars│   │  Chromium)│
                                           │  + CSS)    │   └───────────┘
                                           └────────────┘
                                                 ▲
                                    templates/<name>/ (hbs, css, fonts)
```

Every stage is a plain function. `build()` chains them. The CLI parses arguments, calls `build()` (once or on every change in watch mode), and turns errors into messages and exit codes.

### Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 24, ESM | NFR-4 |
| Validation | `ajv` (JSON Schema 2020-12) | Standard schema, precise error paths (FR-10, FR-11) |
| Templating | `handlebars` | Logic-less templates stay data, not code, so new templates need no code changes (FR-22). Dynamic partials handle section ordering. |
| PDF | `playwright` (bundled Chromium) | Selectable text, working links, good print CSS (FR-14–16, FR-20) |
| Page count | `pdf-lib` | Reliable page count from the generated PDF (FR-19) |
| CLI args | `node:util` `parseArgs` | Built in, no dependency needed |
| Watch | `node:fs` `watch` | Built in. Recursive watching works on macOS and Linux in Node 24. |
| Tests | `node:test` + `node:assert` | Built in (NFR-7) |

Dependency versions are pinned exactly (no `^`), and `package-lock.json` is committed. A Playwright upgrade changes the Chromium build, which can change rendering (NFR-2), so upgrades should be deliberate.

### Alternatives considered

- **Typst instead of HTML + Chromium.** Better typesetting and no ~150 MB browser download. Rejected because it needs a separate install outside npm, and its template language is less familiar than HTML/CSS.
- **Adopting the JSON Resume schema.** Rejected because it can't represent several teams under one employer (FR-2) or configurable section order (FR-5).
- **JS template literals instead of Handlebars.** Templates would become code, and HTML escaping would be manual everywhere. That goes against FR-9 and FR-22.

## 2. Repository layout

```
resume-maker/
├── package.json              # "bin": { "resume": "src/cli.js" }, "type": "module"
├── package-lock.json
├── .gitignore                # node_modules/, out/, data/
├── schema/
│   └── resume.schema.json
├── src/
│   ├── cli.js                # arg parsing, watch loop, error → exit code
│   ├── build.js              # load → validate → render → write
│   ├── validate.js           # Ajv setup, error formatting
│   ├── render.js             # view model, Handlebars helpers, template loading, CSS/font inlining
│   ├── pdf.js                # Chromium lifecycle, HTML → PDF, page count
│   └── errors.js             # UserError
├── templates/
│   └── classic/
│       ├── template.hbs      # page shell: <html>, header, section loop
│       ├── style.css
│       ├── partials/         # one per section + shared pieces
│       │   ├── summary.hbs  skills.hbs  experience.hbs  projects.hbs
│       │   ├── education.hbs  certifications.hbs
│       │   └── highlights.hbs  tech.hbs
│       └── fonts/            # vendored font files + their licence files
├── examples/
│   └── resume.json           # fictional; exercises every section (AC-9)
├── data/                     # git-ignored; personal resumes (NFR-5)
│   └── <you>.json            # your real resume, recreated from the reference PDF
├── test/
│   ├── fixtures/             # invalid inputs for AC-5
│   ├── validate.test.js
│   ├── render.test.js
│   └── pdf.test.js
└── specs/
```

## 3. Content model and schema

### 3.1 Shape

```jsonc
{
  "$schema": "../schema/resume.schema.json",   // optional; gives editor autocompletion
  "sections": ["summary", "skills", "experience", "projects", "education", "certifications"],
  "basics": {
    "name": "Jane Doe",                         // required
    "location": "Springfield, CA",
    "phone": "+1 (555) 010-0000",
    "email": "jane.doe@example.com",
    "links": [{ "label": "linkedin.com/in/janedoe", "url": "https://linkedin.com/in/janedoe" }]
  },
  "summary": "Software Engineer with **8 years** ...",
  "skills": [{ "category": "Languages", "items": ["Java", "Kotlin"] }],
  "experience": [
    {
      "company": "Acme Corp", "title": "Senior Software Engineer",
      "location": "Springfield, CA", "start": "2020-06",
      "teams": [
        { "name": "Payments Platform", "start": "2022-09", "end": "2025-04",
          "tech": ["Java"], "highlights": ["Built ... cutting latency by **40%**."] }
      ]
    },
    {
      "company": "Globex", "title": "Software Engineer", "location": "Shelbyville, CA",
      "start": "2019-01", "end": "2020-06",
      "tech": ["Python"], "highlights": ["..."]
    }
  ],
  "projects": [
    { "name": "resume-maker", "url": "https://github.com/...", "start": "2026-09",
      "tech": ["Node.js"], "highlights": ["..."] }
  ],
  "education": [
    { "institution": "State University", "degree": "MS in Computer Science (**GPA: 3.80**)",
      "location": "Capital City, CA", "start": "2016-09", "end": "2018-12" }
  ],
  "certifications": [
    { "name": "Certified Cloud Architect", "issuer": "Example Institute",
      "date": "2024-03", "url": "https://..." }
  ]
}
```

### 3.2 Schema rules

- **Unknown fields rejected.** `additionalProperties: false` on every object (FR-12). The top-level object also allows `$schema`.
- **Required fields.** Top level requires only `basics`, and `basics` requires only `name`. Each entry requires only its identifying field (FR-3): `category`, `company`, `name` (team, project and certification) or `institution`.
- **Dates.** Strings matching `^\d{4}-(0[1-9]|1[0-2])$` (FR-7).
- **URLs.** Strings with `format: "uri"`, checked by `ajv-formats`.
- **`sections`.** An array of `enum` section names with `uniqueItems: true`. An unknown or duplicated name is a validation error (FR-5).
- **Employer form (FR-2).** An employer has *either* `teams` or direct `tech`/`highlights`, never both. This is enforced with `if: { required: ["teams"] } then: { not: { anyOf: [{ required: ["tech"] }, { required: ["highlights"] }] } }`, which produces a clear error message.
- **Empty text.** Strings have `minLength: 1`. An empty string is almost certainly a mistake. To drop content, remove the field instead.

### 3.3 Error formatting (FR-11)

`validate.js` turns Ajv errors into one line each:

```
✖ experience[0].teams[1].start: must be a year-month date like "2024-03" (got "2024-3")
✖ experience[1].highlight: unknown field (did you mean "highlights"?)
✖ sections[2]: unknown section "project" (allowed: summary, skills, experience, projects, education, certifications)
```

- **Path format.** Ajv's `instancePath` (`/experience/0/teams/1/start`) is rewritten to dotted/bracket form. For `additionalProperties` errors, the unknown key is appended to the path.
- **Readable messages.** Error keywords (`pattern`, `required`, `enum`, `additionalProperties`, `type`, `format`) map to plain-English messages. Anything else falls back to Ajv's own message.
- **"Did you mean".** Picks the allowed key with the smallest edit distance, only when that distance is ≤ 2.
- **All errors at once.** Ajv runs with `allErrors: true`, so you can fix every error in one pass.

Invalid JSON syntax is reported as `<file>: invalid JSON — <parser message>` before schema validation runs.

## 4. Rendering

### 4.1 View model

`render.js` builds a view model that doesn't depend on any template, so templates contain no content logic:

```js
{
  basics,                                   // as given
  sections: [                               // resolved order, only non-empty sections
    { name: "summary",    data: "..." },
    { name: "experience", data: [...] },
  ],
  paper: "letter" | "a4",
}
```

How sections are resolved (FR-4, FR-5):
1. Start from `input.sections`, or use the default order if it isn't given.
2. Drop any section whose data is missing, an empty string or an empty array.

This gives the rules from FR-5: an unlisted section is hidden, a listed but empty section is skipped, and there are no leftover headings, because a template only ever sees non-empty sections.

### 4.2 Templates

A template is a directory `templates/<name>/` with this contract:

| File | Required | Purpose |
|---|---|---|
| `template.hbs` | yes | Full HTML document. Gets the view model. |
| `style.css` | yes | Inlined into `<head>`. |
| `partials/<section>.hbs` | yes, one per section name | Renders one section. Called dynamically. |
| `partials/*.hbs` (other) | no | Shared pieces (e.g. `highlights`, `tech`). |
| `fonts/*` | no | Referenced from `style.css` with relative `url()`. |

`template.hbs` loops over sections and calls each partial by name:

```hbs
{{#each sections}}
  <section class="section section--{{name}}">{{> (lookup . "name") data=data}}</section>
{{/each}}
```

- **Template check at load.** When a template loads, the engine checks that a partial exists for every section name. A missing one fails the build with `template "x" has no partial for section "projects"` (FR-23). A template name that doesn't exist fails with a list of the available names.
- **Where templates come from.** They are found in the repo's `templates/` directory relative to the package root, not the working directory.

### 4.3 Helpers

Every template gets these helpers:

| Helper | Behaviour |
|---|---|
| `{{md text}}` | Escapes HTML first, then turns `**x**` into `<strong>` and `*x*` into `<em>`. Returns a `SafeString`. Escaping first satisfies FR-9 while allowing FR-6. |
| `{{dateRange start end ongoing=true}}` | `"June 2020 – Present"`, `"June 2020 – September 2022"`, or `""` when there are no dates. With `ongoing=false` (projects), a missing end isn't shown as "Present" for a start-only date: `"June 2020"`. |
| `{{date d}}` | `"March 2024"` |
| `{{join list sep=", "}}` | Escapes each item, then joins them. |

All other `{{x}}` output is escaped by Handlebars by default, so escaping is on everywhere, not something each template has to opt into.

Month names are hard-coded in English. `Intl` is deliberately not used, so output doesn't depend on the machine's locale (NFR-2).

### 4.4 CSS, fonts and page setup

- **Inlining.** `style.css` is inlined into a `<style>` tag. Every relative `url(...)` in it is resolved against the template directory and replaced with a base64 `data:` URI. The HTML handed to Chromium is then fully self-contained: there are no file paths to resolve from `setContent`'s `about:blank` origin, and the PDF can't fall back to a system font because a font file failed to load (NFR-6, NFR-2).
- **Paper size.** The engine adds `@page { size: letter | A4; }` after the template CSS. Templates set margins in their own `@page` rule. `page.pdf()` is called with `preferCSSPageSize: true`, so the paper size and the template's margins come from one place: the CSS (FR-18).
- **Page breaks (FR-20).** The `classic` template sets `break-inside: avoid` on list items, team blocks, project entries, and education and certification lines. It also sets `break-after: avoid` on section headings and employer header lines.

### 4.5 `classic` template

- **Fonts.** Vendored in `templates/classic/fonts/` together with their licence files:
  - **Body:** Carlito, metric-compatible with Calibri (SIL OFL 1.1). Regular, bold, italic and bold-italic, as `woff2`.
  - **Name and section headings:** Spectral bold (SIL OFL 1.1), as `woff2`. A Palatino clone (TeX Gyre Pagella) was tried first, but the free clones ship CFF outlines, which Chromium embeds as Type 3 fonts that text extractors misread (the name extracted as "Sh ail R. Sh h a"). Only TrueType-outline fonts are used, and a test guards this (FR-15).
- **Palette.** Starting values, tuned by eye against the reference during implementation:
  - `--navy: #1f3864` for the name, headings and company names;
  - `--accent: #2e5cb8` for rules, bullets, locations and dates;
  - `--text: #111`.
- **Layout.** Follows FR-24. Header lines with right-aligned dates use `display: flex; justify-content: space-between`. Skills use a two-column CSS grid (`grid-template-columns: max-content 1fr`). Bullets are a `::before` pseudo-element with `▸` and a hanging indent, so the marker doesn't become part of the copied text (FR-15, AC-7).
- **Links.** Real `<a href>` elements, styled like the surrounding text, so they're clickable in the PDF (FR-16) without looking like web links.

## 5. Output

### 5.1 PDF (`pdf.js`)

```
launch Chromium (once per process)
  → newPage → setContent(html, { waitUntil: "load" })
  → await document.fonts.ready
  → page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true })
  → close page
count pages with pdf-lib → warn if > 1 (FR-19)
```

- **Shared browser.** The browser instance lives in a module-level variable and is reused across builds, which keeps watch-mode rebuilds fast (NFR-3). The CLI closes it on exit and on SIGINT.
- **`tagged: true`.** Produces a tagged PDF with logical reading order, which helps ATS parsing (FR-15).
- **Chromium install.** Happens once through a `postinstall` script (`playwright install chromium`). After that, builds need no network (NFR-1).

### 5.2 Writing files

- **Default output path.** `out/<input basename>.pdf`. The `out/` directory is git-ignored, so generated personal resumes can't be committed by accident (NFR-5).
- **No output on failure.** Output is written only after rendering succeeds, so a failed build never leaves a partial file behind (FR-13).

## 6. CLI

```
resume build <input.json> [options]
  -t, --template <name>    template name (default: classic)
  -o, --out <path>         output path (default: out/<input>.pdf)
      --paper <size>       letter | a4 (default: letter)
  -w, --watch              rebuild on changes to input or template
resume validate <input.json>
```

Run it with `npx resume ...` or `npm run build -- ...` (FR-25, FR-26, FR-28).

### Errors and exit codes (FR-29)

- **Expected failures** throw `UserError`: bad arguments, missing file, invalid JSON, schema errors, unknown template, missing partial. The CLI prints the message and exits with `1`, without a stack trace.
- **Unexpected errors** (bugs, Chromium crashes) print the message and exit with `2`. The stack is printed only when `DEBUG=1` is set.

### Watch mode (FR-27)

- **What's watched.** The input file's *directory*, filtered to the input's filename, plus the template directory, recursively. Editors often save by writing a temp file and renaming it, which breaks a watch on the file itself.
- **Debounce.** Events are debounced by 100 ms, so one save triggers one rebuild.
- **Failures don't stop it.** A failed rebuild (e.g. invalid JSON mid-edit) prints the error and keeps watching. Each build prints a timestamped `✔ built out/x.pdf (1 page, 840 ms)`.
- **Template partials.** They are re-read on every build, so template edits are picked up without restarting.

## 7. Testing (NFR-7)

`npm test` runs `node --test`.

| File | Covers |
|---|---|
| `validate.test.js` | Example resume passes. Each fixture fails with the expected path and message: typo'd field, wrong type, malformed date, unknown section, duplicate section, employer with both `teams` and `highlights` (AC-5). |
| `render.test.js` | Section resolution (default order, custom order, hidden, empty-skipped: AC-2, AC-3). `md` escaping and emphasis, including `<script>` inside `**…**` (FR-6, FR-9). `dateRange` cases (FR-7). Every section renders in `classic` (FR-23). Missing partial and unknown template errors. |
| `pdf.test.js` | Example builds to a 1-page PDF. Oversized input produces >1 page and a warning (AC-6). |

These are checked manually, since they depend on visual judgement or extra tooling:
- **AC-1:** side-by-side visual comparison with the reference.
- **AC-7:** text extraction with `pdftotext`.
- **AC-8:** watch mode.

## 8. Requirement traceability

| Requirement | Where |
|---|---|
| FR-1–3, FR-7, FR-10–13 | `schema/resume.schema.json`, `validate.js` |
| FR-4, FR-5, FR-8 | `render.js` view model |
| FR-6, FR-9 | `md` helper, Handlebars default escaping |
| FR-14–16, FR-18–20 | `pdf.js`, `classic/style.css`, `render.js` CSS/font inlining |
| FR-21–24 | template contract (§4.2), `templates/classic/` |
| FR-25–29 | `cli.js`, `errors.js` |
| NFR-1, NFR-2, NFR-6 | vendored fonts, data-URI inlining, pinned versions, fixed month names |
| NFR-5 | `.gitignore` (`data/`, `out/`), fictional `examples/resume.json` |

## 9. Risks

- **Chromium download (~150 MB) at install.** This is the price of HTML/CSS templates. It's acceptable for a local tool.
- **Substitute fonts change line lengths slightly.** Carlito matches Calibri's metrics, so body text wraps the same way. Spectral is only used for the name and headings, so it doesn't affect whether the resume fits on one page.
- **Headless-Chromium rendering can differ between macOS and Linux** (font hinting). This affects looks only, not content. Linux isn't a v1 acceptance target (NFR-4).
