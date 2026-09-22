#!/usr/bin/env node
import { watch } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { build, defaultOutPath, loadResume } from './build.js';
import { UserError } from './errors.js';
import { closeBrowser } from './pdf.js';
import { DEFAULT_TEMPLATES_DIR, listTemplates } from './render.js';

const USAGE = `Usage:
  resume build <input.json> [options]
    -t, --template <name>   template name (default: classic)
    -o, --out <path>        output path (default: out/<input>.pdf)
        --paper <size>      letter | a4 (default: letter)
    -w, --watch             rebuild on changes to the input or template
  resume validate <input.json>`;

const PAPER_SIZES = ['letter', 'a4'];

function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        template: { type: 'string', short: 't', default: 'classic' },
        out: { type: 'string', short: 'o' },
        paper: { type: 'string', default: 'letter' },
        watch: { type: 'boolean', short: 'w' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    throw new UserError(`${err.message}\n\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (values.help) return { command: 'help' };
  const [command, input, ...extra] = positionals;
  if (!['build', 'validate'].includes(command) || !input || extra.length) throw new UserError(USAGE);
  if (!PAPER_SIZES.includes(values.paper)) {
    throw new UserError(`--paper must be one of: ${PAPER_SIZES.join(', ')} (got "${values.paper}")`);
  }
  return { command, input, ...values, out: values.out ?? defaultOutPath(input) };
}

async function buildOnce({ input, template, paper, out, watch }) {
  const started = performance.now();
  const result = await build(input, { template, paper, out });
  const ms = Math.round(performance.now() - started);
  const time = watch ? `[${new Date().toTimeString().slice(0, 8)}] ` : '';
  console.log(`${time}✔ built ${result.out} (${result.pages} ${result.pages === 1 ? 'page' : 'pages'}, ${ms} ms)`);
  if (result.pages > 1) console.warn(`⚠ ${result.out} is ${result.pages} pages; a resume should usually fit on one`);
}

async function watchBuild(args) {
  const available = await listTemplates();
  if (!available.includes(args.template)) {
    throw new UserError(`unknown template "${args.template}" (available: ${available.join(', ') || 'none'})`);
  }

  let running = null;
  let pending = false;
  const rebuild = async () => {
    if (running) {
      pending = true;
      return;
    }
    do {
      pending = false;
      running = buildOnce(args).catch(report);
      await running;
    } while (pending);
    running = null;
  };

  let timer;
  const trigger = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  };
  const controller = new AbortController();
  const file = path.basename(args.input);
  // Watch the directory, not the file: editors that save via rename would orphan a file watcher.
  watch(path.dirname(args.input), { signal: controller.signal }, (_, name) => {
    if (name === file) trigger();
  });
  watch(path.join(DEFAULT_TEMPLATES_DIR, args.template), { recursive: true, signal: controller.signal }, trigger);

  await rebuild();
  console.log(`watching ${args.input} and template "${args.template}" (Ctrl+C to stop)`);
  await new Promise((resolve) => process.once('SIGINT', resolve));
  clearTimeout(timer);
  controller.abort();
  await running;
}

function report(err) {
  if (err instanceof UserError) {
    console.error(err.message);
    return 1;
  }
  console.error(process.env.DEBUG === '1' ? err.stack : `unexpected error: ${err.message} (set DEBUG=1 for details)`);
  return 2;
}

async function main(argv) {
  const args = parseCli(argv);
  if (args.command === 'help') {
    console.log(USAGE);
  } else if (args.command === 'validate') {
    await loadResume(args.input);
    console.log(`✔ ${args.input} is valid`);
  } else if (args.watch) {
    await watchBuild(args);
  } else {
    await buildOnce(args);
  }
}

try {
  await main(process.argv.slice(2));
} catch (err) {
  process.exitCode = report(err);
} finally {
  await closeBrowser();
}
