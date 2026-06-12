'use strict';

/**
 * keytidy core — pure JSON key-ordering logic. No fs, no process, no clock.
 *
 * Two jobs:
 *   1. Generic JSON — recursively sort every object's keys alphabetically.
 *      Arrays keep their order (arrays are data, not config); primitives are
 *      untouched. The point is to kill the diff noise from tools that emit keys
 *      in arbitrary order.
 *   2. package.json — sorting it alphabetically would be *wrong* (`name` should
 *      come before `dependencies`, not after `bugs`). So package.json gets the
 *      conventional field order at the top level, its dependency objects sorted
 *      alphabetically, and its `scripts` block left in the author's order
 *      (script order is frequently meaningful).
 *
 * Everything here is pure so the Node and Python ports share one behavior. The
 * fs/CLI plumbing lives in bin/cli.js.
 */

// Conventional top-level order for package.json (npm's own ordering plus what
// the ecosystem settled on). Keys not in this list are appended alphabetically.
const PACKAGE_FIELD_ORDER = [
  '$schema', 'name', 'displayName', 'version', 'private', 'description',
  'keywords', 'license', 'licenses', 'homepage', 'repository', 'bugs', 'funding',
  'author', 'contributors', 'maintainers', 'type', 'imports', 'exports', 'main',
  'module', 'browser', 'unpkg', 'jsdelivr', 'types', 'typings', 'typesVersions',
  'bin', 'man', 'files', 'directories', 'scripts', 'config', 'sideEffects',
  'workspaces', 'engines', 'engineStrict', 'os', 'cpu', 'packageManager',
  'publishConfig', 'dependencies', 'devDependencies', 'peerDependencies',
  'peerDependenciesMeta', 'optionalDependencies', 'bundledDependencies',
  'bundleDependencies', 'overrides', 'resolutions',
];

// Within package.json, these object values keep their original key order.
// (Script order is meaningful: pretest/test/posttest, build steps, etc.)
const PRESERVE_ORDER_FIELDS = new Set(['scripts']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Detect the indentation used by an existing JSON document so rewriting it
 * doesn't churn whitespace. Returns a space count, the string "\t", or 2.
 *
 * @param {string} text
 * @returns {number|string}
 */
function detectIndent(text) {
  const m = /\n([ \t]+)["\]{}]/.exec(text);
  if (!m) return 2;
  return m[1][0] === '\t' ? '\t' : m[1].length;
}

/**
 * Return the keys of a package.json object in conventional order: known fields
 * first (in canonical sequence), then any unknown fields alphabetically.
 *
 * @param {string[]} keys
 * @returns {string[]}
 */
function orderPackageKeys(keys) {
  const known = new Set(PACKAGE_FIELD_ORDER);
  const present = PACKAGE_FIELD_ORDER.filter((k) => keys.includes(k));
  const unknown = keys.filter((k) => !known.has(k)).sort();
  return [...present, ...unknown];
}

/**
 * Recursively produce a key-sorted copy of `value`.
 *
 * @param {*} value
 * @param {object} opts            { sortScripts, allKeys }
 * @param {boolean} packageTop     true only for the top-level package.json object
 * @returns {*}
 */
function sortValue(value, opts, packageTop) {
  if (Array.isArray(value)) {
    return value.map((v) => sortValue(v, opts, false));
  }
  if (!isPlainObject(value)) return value;

  const keys = Object.keys(value);
  const ordered = (packageTop && !opts.allKeys) ? orderPackageKeys(keys) : keys.slice().sort();

  const out = {};
  for (const k of ordered) {
    const preserve = packageTop && !opts.sortScripts && PRESERVE_ORDER_FIELDS.has(k);
    out[k] = preserve ? value[k] : sortValue(value[k], opts, false);
  }
  return out;
}

/**
 * Serialize with the project's conventions: given indent, ": " / ",\n"
 * separators (the JSON.stringify defaults), UTF-8 (no \uXXXX escaping).
 *
 * @param {*} value
 * @param {number|string} indent
 * @returns {string}
 */
function serialize(value, indent) {
  return JSON.stringify(value, null, indent);
}

/**
 * Sort one JSON document. Parses, reorders, re-serializes, and reports whether
 * the result differs from the input. Throws on invalid JSON.
 *
 * @param {string} text
 * @param {object} [opts]   { packageJson, indent, sortScripts, allKeys }
 * @returns {{ output: string, changed: boolean }}
 */
function process(text, opts = {}) {
  const data = JSON.parse(text);
  const indent = opts.indent != null ? opts.indent : detectIndent(text);
  const packageTop = !!opts.packageJson && isPlainObject(data);
  const sorted = sortValue(data, { sortScripts: !!opts.sortScripts, allKeys: !!opts.allKeys }, packageTop);
  let output = serialize(sorted, indent);
  if (/\n$/.test(text)) output += '\n';
  return { output, changed: output !== text };
}

module.exports = {
  PACKAGE_FIELD_ORDER,
  PRESERVE_ORDER_FIELDS,
  detectIndent,
  orderPackageKeys,
  sortValue,
  serialize,
  process,
};
