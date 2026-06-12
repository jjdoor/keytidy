# keytidy

**Tidy JSON key order — and sort `package.json` the way it's actually meant to
look.** Inconsistent key order is pure diff noise: one teammate's editor writes
`name` first, another's tool writes it last, and every PR churns lines that
didn't really change. keytidy gives every JSON file one deterministic order.
**Zero dependencies.**

```bash
npx keytidy                 # sort ./package.json in place
npx keytidy --check         # CI gate: exit 1 if anything isn't sorted
```

## It's not just "sort all the keys"

Sorting `package.json` alphabetically would be *wrong* — `name` belongs at the
top, not wedged between `module` and `optionalDependencies`. So keytidy treats
`package.json` specially:

- **Top-level fields** follow the conventional order (`name`, `version`,
  `description`, …, `scripts`, `dependencies`, `devDependencies`, …). Unknown
  fields (your `jest`, `prettier`, etc.) sort alphabetically after the known ones.
- **Dependency blocks** (`dependencies`, `devDependencies`, `peerDependencies`,
  …) are sorted A→Z — the part you actually want sorted.
- **`scripts` is left in your order**, because script order is frequently
  meaningful (`pretest` → `test` → `posttest`, ordered build steps). Opt in with
  `--sort-scripts` if you disagree.

Every other `.json` file just gets a clean recursive alphabetical sort, with
**arrays left in their original order** (an array is data, not config).

## Example

```jsonc
// before
{ "version": "1.0.0", "scripts": { "test": "…", "build": "…" },
  "name": "demo", "dependencies": { "zod": "…", "axios": "…" } }

// after  →  npx keytidy
{
  "name": "demo",
  "version": "1.0.0",
  "scripts": { "test": "…", "build": "…" },        // order preserved
  "dependencies": { "axios": "…", "zod": "…" }      // sorted A→Z
}
```

## Usage

```bash
keytidy                    # sort ./package.json in place
keytidy package.json tsconfig.json
keytidy *.json             # your shell expands the glob
keytidy --check            # don't write; exit 1 if any file isn't sorted
keytidy --stdout pkg.json  # print the sorted result instead of writing
keytidy --indent 4         # force 4-space indent (default: detected, else 2)
keytidy --sort-scripts     # also sort the package.json scripts block
keytidy --all-keys         # ignore the conventional order, sort A→Z
```

Indentation is **detected from the file** and preserved, so keytidy doesn't
fight your existing 2-space / 4-space / tab style. The trailing newline is kept
as-is.

### As a CI / pre-commit gate

```yaml
- run: npx keytidy --check        # fails the build if package.json drifted
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | sorted (write mode) or everything already sorted (`--check`) |
| `1` | a file needs sorting (`--check` only) |
| `2` | invalid JSON, or a file couldn't be read/written |

## Notes

- It rewrites by parsing and re-serializing, so it normalizes JSON formatting
  (whitespace, number representation). It does **not** support comments or
  trailing commas (JSONC / `tsconfig.json` with comments will report invalid
  JSON rather than mangle them).
- The sort itself is pure and deterministic, shared by the Node and Python ports.

## Also available for Python

Same behavior, same flags: [`pip install keytidy`](https://pypi.org/project/keytidy/)
(source: [keytidy-py](https://github.com/jjdoor/keytidy-py)).

## License

MIT
