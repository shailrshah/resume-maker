#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { build, defaultOutPath, loadResume } from './build.js';
import { UserError } from './errors.js';
import { closeBrowser } from './pdf.js';

const USAGE = `Usage:
  resume build <input.json> [options]
    -t, --template <name>   template name (default: classic)
    -o, --out <path>        output path (default: out/<input>.pdf)
        --paper <size>      letter | a4 (default: letter)
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

async function buildOnce({ input, template, paper, out }) {
  const started = performance.now();
  const result = await build(input, { template, paper, out });
  const ms = Math.round(performance.now() - started);
  console.log(`✔ built ${result.out} (${result.pages} ${result.pages === 1 ? 'page' : 'pages'}, ${ms} ms)`);
  if (result.pages > 1) console.warn(`⚠ ${result.out} is ${result.pages} pages; a resume should usually fit on one`);
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
