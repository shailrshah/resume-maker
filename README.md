# resume-maker

Build a one-page PDF resume from a JSON file. You write the content as data; a template controls how it looks. The output is ATS-friendly: real selectable text, clickable links, and headings that extract as whole words.

## Setup

Requires Node.js 24.

```sh
npm install   # also downloads the headless Chromium used to render PDFs
```

## Usage

```sh
npx resume build examples/resume.json        # → out/resume.pdf
npx resume build my.json -o ~/Desktop/cv.pdf # custom output path
npx resume build my.json --paper a4          # letter (default) or a4
npx resume build my.json -t classic          # choose a template
npx resume build my.json --watch             # rebuild on every save
npx resume validate my.json                  # check the JSON without building
```

The tool warns you if the resume runs past one page, or if it contains characters the template's fonts don't cover (arrows, most symbols), which get embedded in a form ATS parsers can misread. Invalid input is reported with the exact path and reason, and no PDF is written:

```
my.json is invalid:
✖ experience[0].teams[1].start: must be a year-month date like "2024-03" (got "2024-3")
✖ experience[1].highlight: unknown field (did you mean "highlights"?)
```

Keep your own resume in `data/`. It's git-ignored, as is `out/`, so personal details never get committed.

## Writing your resume

Start from [`examples/resume.json`](examples/resume.json), which uses every feature. The full format is defined in [`schema/resume.schema.json`](schema/resume.schema.json). Keep the `"$schema"` line at the top of your file and editors such as VS Code will autocomplete fields and flag mistakes as you type.

- **Sections:** `summary`, `skills`, `experience`, `projects`, `education` and `certifications`. All are optional, and empty ones are left out cleanly.
- **Order and visibility:** set `"sections": ["summary", "experience", "education"]` to choose which sections appear and in what order. Without it, all sections with content appear in the order listed above.
- **Several roles at one employer:** give the employer a `teams` array, each team with its own dates, `tech` and `highlights`. Otherwise put `tech` and `highlights` directly on the employer.
- **Dates:** `"YYYY-MM"`. Leave out `end` for a current role and it shows as "Present".
- **Emphasis:** `**bold**` and `*italic*` work in the summary, highlights and degree text.

## Templates

A template is a folder under `templates/`:

```
templates/<name>/
├── template.hbs        # the page; CSS arrives as {{{styles}}}
├── style.css           # fonts and images referenced by relative url()
├── partials/<section>.hbs   # one per section: summary, skills, experience, ...
└── fonts/
```

Templates use [Handlebars](https://handlebarsjs.com/). Inside a section partial, `data` is that section's content and `@root.basics` is the header. Available helpers: `md` (bold/italic markup), `dateRange`, `date` and `join`. Copy `templates/classic` as a starting point.

Use fonts with TrueType outlines, such as most Google Fonts. Fonts with CFF/PostScript outlines (many `.otf` files) are embedded by Chromium in a form that text extractors misread.

## Development

```sh
npm test
```

Design notes and requirements are in [`specs/`](specs/).

## Licence notes

The `classic` template bundles [Carlito](https://fonts.google.com/specimen/Carlito) and [Spectral](https://fonts.google.com/specimen/Spectral), both under the SIL Open Font License 1.1. Licence texts are in `templates/classic/fonts/`.
