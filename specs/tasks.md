# Resume Maker — Tasks

Implements [`design.md`](./design.md). Each task ends in a small commit with passing tests (`npm test`). Requirement IDs refer to [`requirements.md`](./requirements.md).

## Execution plan

| Round | Work | How |
|---|---|---|
| 0 | T1 | On `main`. Installs every dependency, so later branches never touch `package.json` or the lockfile. |
| 1 | **A:** T2 + T3 · **B:** T4 + T5 · **C:** T7 + T6 | In parallel, each on its own branch and worktree (`feat/validation`, `feat/render`, `feat/pdf-template`). The interfaces between them are fixed by the design. |
| 2 | Merge A → B → C into `main` | Review each diff and run the full suite after each merge. |
| 3 | T8 → T9 → T10 → T11 | In order, on `main`. T10 needs the author's visual review. |

## T1. Scaffold the project

- [x] `package.json`: `"type": "module"`, `"bin": { "resume": "src/cli.js" }`, and scripts `test` (`node --test`), `build` and `postinstall` (`playwright install chromium`).
- [x] Dependencies pinned to exact versions: `ajv`, `ajv-formats`, `handlebars`, `playwright`, `pdf-lib`.
- [x] `.gitignore`: `node_modules/`, `out/`, `data/`.
- [x] `src/errors.js` with `UserError`.

**Done when:** `npm install` completes, including the Chromium download, and `npm test` runs with 0 tests.

## T2. Schema and example resume

- [x] `schema/resume.schema.json` following design §3.2:
  - `additionalProperties: false` everywhere (with `$schema` allowed at the top level);
  - identifying fields required, and `minLength: 1` on strings;
  - date pattern, `format: "uri"` on URLs;
  - `sections` as a unique `enum` array;
  - the employer rule: `teams` *or* `tech`/`highlights`.
- [x] `examples/resume.json`: a fictional person using every section. It includes one employer with teams and one without, and uses inline `**bold**`.

**Done when:** the example passes the schema. Covers FR-1–3, FR-7, FR-10, FR-12, AC-9 (content).

## T3. Validation and error formatting

- [x] `src/validate.js`:
  - Ajv 2020 with `allErrors: true` and `ajv-formats`;
  - paths rewritten to `a[0].b` form, with the unknown key appended for `additionalProperties` errors;
  - plain-English messages per error keyword;
  - "did you mean" suggestions (edit distance ≤ 2).
- [x] Invalid JSON syntax reported as `<file>: invalid JSON — …`.
- [x] `test/fixtures/`, one file per error case: typo'd field, wrong type, malformed date, unknown section, duplicate section, employer with both `teams` and `highlights`.
- [x] `test/validate.test.js`.

**Done when:** each fixture reports the expected path and message. Covers FR-11–13, AC-5.

## T4. View model and helpers

- [x] `src/render.js` view model:
  - section resolution: default order, custom order, unlisted sections hidden, empty sections skipped;
  - `basics` passed through as given;
  - paper size included.
- [x] Helpers:
  - `md`: escapes first, then applies `**`/`*`;
  - `dateRange`, with the `ongoing` flag;
  - `date`;
  - `join`: escapes each item;
  - month names hard-coded in English.
- [x] Tests in `test/render.test.js`:
  - section resolution cases;
  - `md` with `<script>` inside `**…**`;
  - every `dateRange` case (both dates, start only with and without `ongoing`, no dates).

**Done when:** the tests pass. Covers FR-4–9, AC-2, AC-3 (logic).

## T5. Template loading and HTML assembly

- [x] Resolve `templates/<name>/` relative to the package root. An unknown name gives a `UserError` listing the available templates.
- [x] Register every `partials/*.hbs`. A missing partial for any section name gives a `UserError`.
- [x] Inline `style.css` into the page, replacing each relative `url()` with a base64 `data:` URI. Append `@page { size: … }`.
- [x] Test fixtures: a minimal template in `test/fixtures/templates/`, plus a copy of it with one partial removed.

**Done when:** the fixture template renders the example resume to HTML with no external references, and the missing-partial and unknown-template tests pass. Covers FR-21–23.

## T6. `classic` template

- [x] Vendor the fonts into `templates/classic/fonts/`, each with its licence file:
  - Carlito (regular, bold, italic, bold-italic) as `woff2`;
  - Spectral bold as `woff2` (replaced TeX Gyre Pagella in T10: its CFF outlines embed as Type 3 fonts).
- [x] `template.hbs` with the header and section loop. Partials for all six sections, plus `highlights` and `tech`.
- [x] `style.css` following design §4.5:
  - palette tokens;
  - flex header lines with right-aligned dates;
  - two-column grid for skills;
  - `▸` bullets as `::before` with a hanging indent;
  - `break-inside` and `break-after` rules;
  - `@page` margins.
- [x] Test: every section renders with `classic`.

**Done when:** the rendered HTML contains every section in order. Visual polish happens in T10. Covers FR-20, FR-23, FR-24.

## T7. PDF output

- [x] `src/pdf.js`:
  - one shared browser, launched lazily;
  - `setContent`, then wait for `document.fonts.ready`;
  - `page.pdf({ preferCSSPageSize, printBackground, tagged })`;
  - `close()`.
- [x] Count pages with `pdf-lib` and return the count.
- [x] Tests in `test/pdf.test.js`: the example gives a 1-page PDF, and oversized input gives more than 1 page.

**Done when:** the tests pass. Covers FR-14–16, FR-18, FR-19 (count), AC-6.

## T8. Build pipeline and CLI

- [x] `src/build.js`: load → validate → render → pdf → write. The output directory is created only when needed, and nothing is written on failure.
- [x] `src/cli.js` with `parseArgs`:
  - `build` and `validate` commands;
  - `-t`, `-o`, `--paper`, `-w` options;
  - default output `out/<basename>.pdf`;
  - page-count warning;
  - exit code `1` for `UserError` and `2` for anything else, with the stack only when `DEBUG=1`;
  - browser closed on exit.

**Done when:**
- `npx resume build examples/resume.json` writes `out/resume.pdf`;
- `npx resume validate` on a bad fixture exits with `1` and prints the errors;
- `--paper a4` changes the page size.

Covers FR-13, FR-19, FR-25, FR-26, FR-28, FR-29.

## T9. Watch mode

- [x] Watch the input file's directory (filtered to its filename) and the template directory, recursively. Debounce by 100 ms.
- [x] A failed rebuild prints the error and keeps watching. Each build prints a timestamped line with the page count and duration.
- [x] The shared browser is reused across rebuilds and closed on SIGINT.

**Done when:** a manual check passes. Editing the JSON, including saving it invalid mid-edit and then fixing it, regenerates the PDF without a restart. Covers FR-27, AC-8, NFR-3.

## T10. Your resume and visual tuning

- [x] Recreate the reference resume as `data/<you>.json`. The file is git-ignored and never committed.
- [x] Build it and compare it side by side with `Shail_R_Shah_Resume.pdf`. Tune the `classic` palette, font sizes, spacing and margins until they match and the result fits on one page.
- [x] Check text extraction with `pdftotext` for reading order, and confirm the links are clickable.

**Done when:** AC-1 and AC-7 pass on visual and manual inspection. Covers FR-15, FR-16, FR-24, G3.

## T11. Acceptance pass

- [x] Go through AC-1 to AC-9 and record the result of each (automated or manual).
- [x] Time a cold build and a watch-mode rebuild against NFR-3 (under 5 s).

**Done when:** every acceptance criterion passes, or any failures are written down with a follow-up.

## Acceptance results

Recorded on 2026-09-22 against `main`.

| Criterion | Result | How checked |
|---|---|---|
| AC-1 matches reference | Pass, pending author sign-off | Side-by-side render of `data/<you>.json` vs the reference PDF. The line breaks match. Headings use Spectral instead of a Palatino clone (see design §4.5). |
| AC-2 remove a section | Pass | `render.test.js` (hidden and empty sections), plus a real PDF with `sections` limited to two entries |
| AC-3 reorder sections | Pass | `render.test.js`, plus a real PDF with Education before Experience |
| AC-4 Projects and Certifications | Pass | `classic.test.js` renders every section. All 5 links in the example PDF are clickable. |
| AC-5 validation errors | Pass | `validate.test.js`, `cli.test.js` (exit code 1, no file written) |
| AC-6 more than one page | Pass | `pdf.test.js`, plus a manual CLI run: `⚠ … is 2 pages`, exit code 0 |
| AC-7 text extraction | Pass (reading order fixed later) | Originally checked only with macOS PDFKit, which sorts text by position and hid a bug: absolutely positioned bullet markers made Chromium write every bullet at the end of the PDF, so pdf.js-style extractors read them after Education. Fixed by drawing markers inline. `classic.test.js` now checks bullet order with pdf.js. Name intact. `classic.test.js` fails on any Type 3 font. Headings extract as whole words (`TECHNICAL SKILLS`) at 0.05em letter-spacing, half the ~0.1em point where pdf.js and PDFKit start splitting them. `classic.test.js` checks this with pdf.js. |
| AC-8 watch mode | Pass | Manual: editor-style rename save, an invalid save mid-edit, a template edit, then Ctrl+C |
| AC-9 example resume | Pass | `classic.test.js`: valid, uses every section, fits on one page, contains fictional data only |
| NFR-3 under 5 s | Pass | Cold CLI build 0.46 s; watch rebuild about 90 ms |
