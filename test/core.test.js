'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');

const keysOf = (s) => Object.keys(JSON.parse(s));

// ---- orderPackageKeys ------------------------------------------------------

test('orderPackageKeys: known fields canonical, unknown appended A→Z', () => {
  assert.deepEqual(
    core.orderPackageKeys(['dependencies', 'name', 'zzz', 'version', 'aaa']),
    ['name', 'version', 'dependencies', 'aaa', 'zzz'],
  );
});

// ---- detectIndent ----------------------------------------------------------

test('detectIndent reads existing whitespace', () => {
  assert.equal(core.detectIndent('{\n  "a": 1\n}'), 2);
  assert.equal(core.detectIndent('{\n    "a": 1\n}'), 4);
  assert.equal(core.detectIndent('{\n\t"a": 1\n}'), '\t');
  assert.equal(core.detectIndent('{}'), 2);
});

// ---- generic JSON ----------------------------------------------------------

test('generic JSON: object keys sorted recursively', () => {
  const input = JSON.stringify({ b: 1, a: 2, nested: { z: 1, y: 2 } }, null, 2);
  const { output } = core.process(input, { packageJson: false });
  assert.deepEqual(keysOf(output), ['a', 'b', 'nested']);
  assert.deepEqual(Object.keys(JSON.parse(output).nested), ['y', 'z']);
});

test('arrays keep their order; nested objects inside arrays still sort', () => {
  const input = JSON.stringify({ list: [3, 1, 2], rows: [{ b: 1, a: 2 }] });
  const { output } = core.process(input, {});
  const parsed = JSON.parse(output);
  assert.deepEqual(parsed.list, [3, 1, 2]);
  assert.deepEqual(Object.keys(parsed.rows[0]), ['a', 'b']);
});

// ---- package.json ----------------------------------------------------------

const PKG = JSON.stringify({
  version: '1.0.0',
  scripts: { test: 't', build: 'b' },
  name: 'x',
  dependencies: { b: '1', a: '1' },
  description: 'd',
  customField: 1,
}, null, 2);

test('package.json: conventional top-level order, unknown field last', () => {
  const { output } = core.process(PKG, { packageJson: true });
  assert.deepEqual(keysOf(output), ['name', 'version', 'description', 'scripts', 'dependencies', 'customField']);
});

test('package.json: dependencies sorted A→Z but scripts order preserved', () => {
  const parsed = JSON.parse(core.process(PKG, { packageJson: true }).output);
  assert.deepEqual(Object.keys(parsed.dependencies), ['a', 'b']);
  assert.deepEqual(Object.keys(parsed.scripts), ['test', 'build']);
});

test('--sort-scripts also sorts the scripts block', () => {
  const parsed = JSON.parse(core.process(PKG, { packageJson: true, sortScripts: true }).output);
  assert.deepEqual(Object.keys(parsed.scripts), ['build', 'test']);
});

test('--all-keys sorts package.json purely alphabetically', () => {
  const parsed = JSON.parse(core.process(PKG, { packageJson: true, allKeys: true }).output);
  assert.deepEqual(keysOf(core.process(PKG, { packageJson: true, allKeys: true }).output),
    ['customField', 'dependencies', 'description', 'name', 'scripts', 'version']);
});

test('a file NOT named package.json gets plain alphabetical order', () => {
  const { output } = core.process(PKG, { packageJson: false });
  assert.deepEqual(keysOf(output), ['customField', 'dependencies', 'description', 'name', 'scripts', 'version']);
});

// ---- idempotency & formatting ---------------------------------------------

test('already-sorted input reports changed=false (idempotent)', () => {
  const once = core.process(PKG, { packageJson: true }).output;
  const twice = core.process(once, { packageJson: true });
  assert.equal(twice.changed, false);
  assert.equal(twice.output, once);
});

test('trailing newline is preserved either way', () => {
  assert.ok(core.process('{"b":1,"a":2}\n', {}).output.endsWith('\n'));
  assert.ok(!core.process('{"b":1,"a":2}', {}).output.endsWith('\n'));
});

test('indent override wins over detection', () => {
  const out = core.process('{\n  "b": 1,\n  "a": 2\n}', { indent: 4 }).output;
  assert.ok(out.includes('\n    "a"'));
});

test('invalid JSON throws', () => {
  assert.throws(() => core.process('{not json}', {}));
});
