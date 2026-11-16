---

name: suku-release-notes
description: >-
Run a full Suku release: write CHANGELOG notes, bump every @sukujs/* package to
one shared version, tag, publish a public GitHub Release, then publish all
packages to npm together. Use when releasing Suku, cutting vX.Y.Z, shipping to
GitHub/npm, or updating unified package versions.
disable-model-invocation: true
---

# Suku release

End-to-end release for this monorepo. **One version** for every package under
`packages/*`. Never bump or `npm publish` a single package by hand.

## Hard rules

- Change versions only with `bun run version:bump` / `version:set` (never edit `package.json` by hand).
- Release commit is **only** version bumps: `chore(release): vX.Y.Z`. Product work is committed first.
- One git tag: `vX.Y.Z`. Publish **all** packages via `bun run release:publish` (dependency order).
- **Never** run `release:publish` from the agent without the user’s explicit go-ahead for that version (npm 2FA must run in their terminal).
- Publishing is permanent; always dry-run first. If publish fails mid-way, bump a new patch — do not reuse the version.

## Phase A — Notes and version choice

1. Range: last tag → `HEAD` (`git describe --tags --abbrev=0`), unless the user gives another range.
2. Gather: `git log <range> --oneline --no-merges`, full bodies for `feat` / `fix` / `!`, issue links.
3. Propose shared bump (highest change wins; while &lt; `1.0.0` breaking → **minor**):
   - breaking → minor (&lt;1.0) / major (≥1.0)
   - feature → minor (small additions may be patch &lt;1.0)
   - fixes only → patch
4. Confirm **X.Y.Z** with the user.
5. Prepend customer-facing notes to `CHANGELOG.md` (tone like prior GitHub releases). Template:

```markdown
## X.Y.Z — YYYY-MM-DD

Suku X.Y.Z <one-sentence summary>. Every `@sukujs/*` package is published at X.Y.Z.

### Breaking Changes

#### <Title>

<Why.>
**Migration:** <steps.>

### Features

- **<Name>** — <impact>. ([#N](https://github.com/sukujs/sukujs/issues/N))

### Fixes

- **<Area>** — <impact>.

### Documentation

- <Guides/examples.>

**Full changelog**: https://github.com/sukujs/sukujs/compare/vPREV...vX.Y.Z
```

Skip empty sections. Show notes in chat. Commit product work + `CHANGELOG.md` **before** the release commit (ask before committing if the user has not asked to commit).

## Phase B — Unified version bump, tag, push

Only after the tree is clean of product changes (or those are committed):

```bash
bun run version:bump <patch|minor|major>   # or: bun run version:set X.Y.Z
bun run version:check
bun run check
git add packages/*/package.json
git commit -m "chore(release): vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Verify every `packages/*/package.json` shows the same `version`. Abort if `version:check` fails.

## Phase C — Public GitHub Release

Tag must exist on the remote. Prefer **public** (not draft) unless the user asks for draft.

```bash
gh release create "vX.Y.Z" \
  --title "Suku X.Y.Z" \
  --notes "$(cat <<'EOF'
<CHANGELOG section body for this version — opening paragraph through Full changelog link>
EOF
)"
```

If a draft already exists: `gh release edit "vX.Y.Z" --draft=false` (and update notes if needed).

Verify: `gh release view "vX.Y.Z" --json url,isDraft` and return the URL.

## Phase D — npm publish (all packages)

1. User must be logged in (`npm whoami`). Agent does not run `npm login`.
2. Dry run and show output:

   ```bash
   bun run release:dry-run
   ```
3. **Stop and get explicit go-ahead** for version `X.Y.Z`.
4. Tell the user to run in **their** terminal (2FA per package):

   ```bash
   bun run release:publish
   ```

   Preconditions enforced by `scripts/publish.ts`: unified versions, not `0.0.0`, clean tree, `HEAD` tagged `vX.Y.Z`, npm auth, versions not already on the registry. Publishes every `@sukujs/*` package together (`workspace:*` rewritten to `X.Y.Z`).
5. Do not use `npm publish` inside a single package directory.

## Checklist (copy for the turn)

- [ ] Notes in `CHANGELOG.md`; product commits done
- [ ] `version:bump` / `version:set` → all packages identical
- [ ] `bun run check` green
- [ ] `chore(release): vX.Y.Z` + tag `vX.Y.Z`
- [ ] `git push origin main --tags`
- [ ] Public GitHub Release `Suku X.Y.Z`
- [ ] `release:dry-run` reviewed
- [ ] User approved → user runs `release:publish`
