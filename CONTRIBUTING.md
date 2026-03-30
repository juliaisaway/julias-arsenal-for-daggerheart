# Contributing

This repository stores custom Daggerheart adversaries and environments as Markdown source files with frontmatter. The build script compiles those source files into presentation-ready Markdown inside `dist/markdown/`.

## Repository Structure

- `data/`: source Markdown files
- `data/adversaries/`: adversary source files grouped by tier
- `data/environments/`: environment source files grouped by tier
- `templates/`: authoring templates
- `scripts/build.mjs`: validation and compilation script
- `dist/`: generated output recreated on every build

## Commands

```bash
npm run build
```

Builds compiled Markdown output into `dist/markdown/`.

```bash
npm run clean
```

Removes generated files from `dist/`.

## Workflow

1. Add or update source files under `data/adversaries/` or `data/environments/`.
2. Start from the appropriate template:
   - [templates/adversary.template.md](./templates/adversary.template.md)
   - [templates/environment.template.md](./templates/environment.template.md)
3. Run `npm run build`.
4. Confirm the generated files under `dist/markdown/` look correct.
5. Commit only the intended source and script changes.

## Adversary Rules

Use [templates/adversary.template.md](./templates/adversary.template.md) as the source of truth for authoring structure.

### Frontmatter Rules for Adversaries

- `tier`: required, accepted values `1`, `2`, `3`, or `4`
- `role`: required, accepted values `bruiser`, `horde`, `leader`, `minion`, `ranged`, `skulk`, `social`, `solo`, `standard`, `support`
- `difficulty`: required, non-negative number
- `thresholds`: required, array of exactly two numbers with the first lower than the second
- `healthPoints`: required, non-negative number
- `stress`: required, non-negative number
- `attack`: required, signed integer string such as `+1` or `-2`
- `weapon`: required text field
- `range`: required, accepted values `Melee`, `Very Close`, `Close`, `Far`, `Very Far`
- `damage`: required text field
- `damageType`: required, accepted values `physical` or `magic`
- `experience`: optional, plain text or array

### Body Rules for Adversaries

- The file must include a single H1 title.
- `## Motives & Tactics` is rendered as a single summary line in the compiled output.
- `## Features` should use `### Feature Name - Type` headings.
- Feature text may include multiple paragraphs.

## Environment Rules

Use [templates/environment.template.md](./templates/environment.template.md) as the source of truth for authoring structure.

### Frontmatter Rules for Environments

- `tier`: required, accepted values `1`, `2`, `3`, or `4`
- `type`: required, accepted values `Exploration`, `Social`, `Traversal`, `Event` case-insensitively
- `difficulty`: required, non-negative number
- `potentialAdversaries`: required, non-empty array

### Potential Adversaries Formats

- A plain string entry is valid.
- A grouped entry is valid with `group` plus a non-empty `list`.
- Grouped entries compile to `Group Name (Entry 1, Entry 2)`.

### Body Rules for Environments

- The file must include a single H1 title.
- The opening description is rendered in italics.
- `## Impulses` is rendered as a single summary line.
- `## Features` is rendered under `## Environment Features` in the compiled output.
- Feature headings should use `### Feature Name - Type`.
- `## Flavor` is optional and, when present, is rendered as the final italicized line.

## Notes

- Lines starting with `#` inside frontmatter are treated as comments by the build script.
- `dist/` is generated output and can be rebuilt at any time.
- Example reference files may live in `data/`, but the build script skips `EXAMPLE.md` and `EXAMPLE ENVIRONMENT.md`.
