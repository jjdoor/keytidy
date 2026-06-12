#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const core = require('../src/core.js');

const VERSION = require('../package.json').version;

// ----- tiny color helpers (no dep) -----
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const col = (c, s) => (useColor ? `\x1b[${c}m${s}\x1b[0m` : s);
const red = (s) => col('31', s);
const green = (s) => col('32', s);
const yellow = (s) => col('33', s);
const dim = (s) => col('2', s);
const bold = (s) => col('1', s);

const HELP = `${bold('keytidy')} — tidy JSON key order (and package.json the way it's meant to look).

${bold('Usage')}
  keytidy [file...]      Sort & rewrite the files (defaults to ./package.json)
  keytidy --check        Don't write; exit 1 if anything isn't sorted (CI)
  keytidy --stdout       Print the sorted result instead of writing
  keytidy *.json         Sort every JSON file (your shell expands the glob)

${bold('Options')}
  --indent <n|tab>   Override indentation (default: detected from the file, else 2)
  --sort-scripts     Also sort package.json "scripts" (off — script order matters)
  --all-keys         Sort package.json purely alphabetically (ignore the conventional order)
  --version

${bold('What it does')}
  • generic JSON  — every object's keys sorted A→Z; arrays kept in order
  • package.json  — conventional field order (name, version, …, dependencies),
                    dependency blocks sorted A→Z, "scripts" left as you wrote it

${bold('Exit')}  0 sorted/clean · 1 needs sorting (--check) · 2 bad JSON / IO error
`;

function die(msg) { process.stderr.write(red(`keytidy: ${msg}\n`)); process.exit(2); }

function parseArgs(argv) {
  const opts = { files: [], check: false, stdout: false, indent: null, sortScripts: false, allKeys: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--check': opts.check = true; break;
      case '--stdout': opts.stdout = true; break;
      case '--sort-scripts': opts.sortScripts = true; break;
      case '--all-keys': opts.allKeys = true; break;
      case '--indent': {
        const v = argv[++i];
        if (!v) die('--indent needs a value (a number or "tab")');
        opts.indent = v === 'tab' ? '\t' : (/^\d+$/.test(v) ? parseInt(v, 10) : die('--indent must be a number or "tab"'));
        break;
      }
      default:
        if (a.startsWith('-')) die(`unknown flag: ${a} (try --help)`);
        opts.files.push(a);
    }
  }
  return opts;
}

function resolveFiles(files) {
  if (files.length) return files;
  if (fs.existsSync('package.json')) return ['package.json'];
  die('no files given and no ./package.json found — pass a JSON file');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) { process.stdout.write(HELP); process.exit(0); }
  if (argv.includes('-v') || argv.includes('--version')) { process.stdout.write(VERSION + '\n'); process.exit(0); }

  const opts = parseArgs(argv);
  const files = resolveFiles(opts.files);

  let errored = false;
  let needsSort = false;

  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch (e) { process.stderr.write(red(`✗ ${file} — ${e.code === 'ENOENT' ? 'no such file' : e.message}\n`)); errored = true; continue; }

    let result;
    try {
      result = core.process(text, {
        packageJson: path.basename(file) === 'package.json',
        indent: opts.indent,
        sortScripts: opts.sortScripts,
        allKeys: opts.allKeys,
      });
    } catch (e) {
      process.stderr.write(red(`✗ ${file} — invalid JSON: ${e.message}\n`)); errored = true; continue;
    }

    if (opts.stdout) {
      process.stdout.write(result.output);
      continue;
    }
    if (opts.check) {
      if (result.changed) { needsSort = true; process.stdout.write(`${yellow('✗')} ${file} ${dim('— not sorted')}\n`); }
      else process.stdout.write(`${green('✓')} ${file} ${dim('— sorted')}\n`);
      continue;
    }
    // write mode
    if (result.changed) {
      try { fs.writeFileSync(file, result.output); }
      catch (e) { process.stderr.write(red(`✗ ${file} — ${e.message}\n`)); errored = true; continue; }
      process.stdout.write(`${green('✓')} ${bold(file)} ${dim('— sorted')}\n`);
    } else {
      process.stdout.write(`${dim('•')} ${file} ${dim('— already sorted')}\n`);
    }
  }

  if (errored) process.exit(2);
  if (opts.check && needsSort) {
    if (!opts.stdout) process.stdout.write(`\n${dim('run')} ${bold('keytidy')} ${dim('to fix')}\n`);
    process.exit(1);
  }
  process.exit(0);
}

main();
