# Resume Maker — Requirements

## 1. Overview

A local command-line tool that takes resume content written as JSON, puts it into a visual template, and produces a finished resume document.

The goal is to keep **content** (what the resume says) separate from **presentation** (how it looks). Editing the resume then means editing data, and changing the look means changing or switching the template.

The reference for content and visual style is `Shail_R_Shah_Resume.pdf`, a one-page US Letter software-engineering resume.

## 2. Goals

- G1. Write resume content once in a structured, human-editable JSON file.
- G2. Produce a professional PDF from that file with a single command.
- G3. The default template visually matches the reference resume.
- G4. Support multiple templates without changing the input data.

## 3. Non-goals (v1)

- A web UI, form-based editor or hosted service.
- Importing content from existing PDF or DOCX resumes (automatic parsing).
- Any output format other than PDF (HTML, DOCX, LaTeX, plain text).
- AI-assisted content writing or tailoring to job descriptions.
- Multiple resume variants from one file (e.g. tagging bullets per role type).
- Sections beyond those listed in FR-2 (e.g. Publications, Awards, Volunteering).

## 4. Users

A single technical user (the author) who edits JSON in a code editor and runs commands in a terminal.

## 5. Functional requirements

### 5.1 Input content

- **FR-1** The tool accepts one JSON file as the resume content.
- **FR-2** The content model supports a header plus these sections:
  - **Basics (header):** full name, location, phone, email, and zero or more links (display label + URL).
  - **Summary:** a free-text paragraph.
  - **Skills:** an ordered list of categories. Each has a category name and an ordered list of items.
  - **Experience:** an ordered list of employers. Each employer has:
    - company name, job title, location, start date, and an optional end date;
    - *either* a tech list and highlights directly on the employer (single-role employer, e.g. Yelp),
    - *or* an ordered list of teams/sub-roles (e.g. Amazon). Each team has a name, start date, optional end date, tech list and highlights;
    - both forms are allowed within one resume.
  - **Projects:** an ordered list of entries. Each has a name, optional URL, optional start/end dates, optional tech list and highlights.
  - **Education:** an ordered list of entries. Each has institution, degree, location, start date and optional end date. Grading systems vary by institution (e.g. "GPA: 3.92" vs "CGPA: 7.75"), so any score is written inside the degree text. Its emphasis is controlled per entry with inline markup (FR-6).
  - **Certifications:** an ordered list of entries. Each has a name, optional issuer, optional date and optional URL.
- **FR-3** Only `basics.name` is required at the top level. Every section is optional. Within an entry, only its identifying field is required: skill category, company, team name, project name, institution or certification name.
- **FR-4** A section that is missing, empty or hidden (FR-5) is not rendered, and no leftover heading, rule or separator appears.
- **FR-5** Section order and visibility can be set in the JSON with an ordered list of section names:
  - Listed sections render in the given order, after the header. The header is always first and can't be reordered.
  - A section with content that is not listed is hidden.
  - A listed section with no content is skipped silently.
  - An unknown section name is a validation error.
  - When no order is given, the default is Summary, Skills, Experience, Projects, Education, Certifications.
- **FR-6** Free-text fields (summary, highlights, degree, project and certification text) support inline **bold** and *italic* emphasis with a lightweight markup (e.g. `**text**`). No other formatting is interpreted.
- **FR-7** Dates are given as year and month. A missing end date on an experience, team or education entry means it is ongoing and is shown as "Present". A project with no dates shows no date range.
- **FR-8** List order in the JSON is kept exactly in the output. The tool never re-sorts content.
- **FR-9** Text is escaped safely. Characters such as `<`, `&`, `>` and `"` in content show literally and never break the layout.

### 5.2 Validation

- **FR-10** Input is validated against a published schema before rendering.
- **FR-11** Validation errors name the offending path (e.g. `experience[0].teams[1].start`) and the reason (missing field, wrong type, bad date format, unknown field, unknown section name).
- **FR-12** Unknown fields cause an error, so typos (e.g. `highlight` vs `highlights`) are caught instead of silently ignored.
- **FR-13** If validation fails, the tool produces no output file and exits with a non-zero status.

### 5.3 Output

- **FR-14** The output is a PDF.
- **FR-15** The PDF text is real, selectable text that applicant tracking systems (ATS) can read, not an image. Reading order follows the visual order.
- **FR-16** Links (contact line, project URLs, certification URLs) are clickable in the PDF.
- **FR-17** *(Withdrawn: output is PDF only. The ID is kept so later requirement numbers stay stable.)*
- **FR-18** Paper size defaults to US Letter and can be switched to A4.
- **FR-19** If the rendered resume goes past one page, the tool prints a warning with the page count. It still produces the file.
- **FR-20** Entries (a team block, a project, a bullet) are not split across a page break where avoidable.
- **FR-30** If the PDF contains text that extractors can't reliably read (a font embedded as Type 3, e.g. a system fallback for a character the template's fonts lack), the tool prints a warning. It still produces the file.

### 5.4 Templates

- **FR-21** Templates are self-contained units, selectable by name at build time.
- **FR-22** Adding a new template needs no change to the tool's code or to the input JSON.
- **FR-23** Every template supports every section in FR-2 and honours section order and visibility (FR-5).
- **FR-24** v1 ships one template, `classic`, which reproduces the reference resume:
  - Name in a large navy serif typeface.
  - Contact line items separated by `|`.
  - Summary in italics.
  - Section headings in lightly letter-spaced navy serif capitals, with a blue horizontal rule beneath. Spacing stays small enough that text extraction reads each heading as one word (the reference's wider spacing extracts as `T E C H N I C A L`).
  - Skills laid out as two columns: bold category label, then comma-separated items.
  - Employer line: **Company** · Title — Location in accent colour, with the date range right-aligned.
  - Team line: italic team name, with the italic date range right-aligned.
  - A "**Tech:**" line with the tech list in italics.
  - Highlights as a bulleted list using a blue `▸` marker, with wrapped lines indented under the text.
  - Education lines laid out like employer lines: **Institution** · Degree — Location, with the date range right-aligned.
  - Dates shown as full month name and year (e.g. "September 2022 – April 2025").
  - Projects and Certifications are not in the reference. They are styled to match it:
    - A project follows the employer-block pattern: name line (linked when a URL is given) with dates right-aligned, then the Tech line and highlights.
    - A certification is one line, following the education-line pattern: **Name** · Issuer, with the date right-aligned.

### 5.5 Command-line interface

- **FR-25** A single command builds the resume: input file → output file.
- **FR-26** Options:
  - template name (default `classic`);
  - output path (default derived from the input file name);
  - paper size: Letter or A4.
- **FR-27** A watch mode rebuilds the output automatically when the input JSON or the selected template changes.
- **FR-28** A validate-only command checks the JSON without rendering.
- **FR-29** The exit code is 0 on success and non-zero on any failure (invalid input, unknown template, render error). Error messages are human-readable, not stack traces.

## 6. Non-functional requirements

- **NFR-1 Offline:** builds need no network access once dependencies are installed.
- **NFR-2 Determinism:** the same input, template and options give visually identical output on any supported machine.
- **NFR-3 Performance:** a one-page resume builds in under 5 seconds on a typical laptop, after dependencies are installed.
- **NFR-4 Platform:** runs on macOS with Node.js 24. Linux support is expected but not a v1 acceptance criterion.
- **NFR-5 Privacy:** personal resume data is kept out of version control by default (ignored data directory). The repository includes only a fictional example resume.
- **NFR-6 Fonts:** templates use only freely licensed fonts that come with the tool (bundled in the repo or installed as package dependencies). The user never supplies font files, and output doesn't depend on fonts installed on the system. Close substitutes for the reference resume's fonts are acceptable; exact typeface matching is not required.
- **NFR-7 Testability:** validation, rendering and output generation are covered by automated tests runnable with a single command.

## 7. Acceptance criteria

- **AC-1** Build the reference resume content (recreated as JSON) with the `classic` template. The result is a single US Letter page. Side by side with the reference PDF, it has the same content, section order, hierarchy and styling. Differences from substitute fonts are acceptable.
- **AC-2** Remove any optional section from the JSON, or leave it out of the section order, and rebuild. The section disappears cleanly, with no stray heading or rule.
- **AC-3** Reorder sections in the JSON (e.g. Education before Experience) and rebuild. The output follows the new order.
- **AC-4** Add Projects and Certifications to the reference JSON and rebuild. Both render in the `classic` style (FR-24), and URLs are clickable.
- **AC-5** Introduce a typo'd field name, a wrong type, a malformed date and an unknown section name. Each is reported with its path, no PDF is written, and the exit code is non-zero.
- **AC-6** Add enough highlights to go past one page. The build succeeds and warns that the output is 2 pages.
- **AC-7** Text copied from the generated PDF matches the source content in reading order.
- **AC-8** Editing the JSON during watch mode regenerates the output without restarting the command.
- **AC-9** The committed example resume builds successfully with no personal data present, and it exercises every section.

## 8. Resolved decisions

- **Fonts:** use freely licensed substitutes that come with the tool. The user will not supply fonts. (NFR-6)
- **Education scores:** stay in free text with per-entry inline markup, because grading systems differ between institutions. (FR-2, FR-6)
- **Section order:** configurable from the JSON in v1. (FR-5)
- **Extra sections:** Projects and Certifications are included in v1, both optional. (FR-2, FR-3)
