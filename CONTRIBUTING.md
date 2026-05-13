# Contributing

This repository stores custom Daggerheart adversaries, structures, environments, and traps as Markdown source files with frontmatter. The build script compiles those source files into presentation-ready Markdown inside `dist/markdown/`.

## Repository Structure

- `data/`: source Markdown files
- `data/adversaries/`: adversary source files grouped by tier
- `data/structures/`: multi-statblock structure source folders grouped by tier
- `data/environments/`: environment source files grouped by tier
- `data/traps/`: trap source files grouped by tier
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

1. Add or update source files under `data/adversaries/`, `data/structures/`, `data/environments/`, or `data/traps/`.
2. Start from the appropriate template:
   - [templates/adversary.template.md](./templates/adversary.template.md)
   - [templates/structure.template.md](./templates/structure.template.md)
   - [templates/environment.template.md](./templates/environment.template.md)
   - [templates/trap.template.md](./templates/trap.template.md)
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
- `## Design notes` is optional and, when present, is rendered below the card in a separate notes block.

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
- Environment flavor should live inside `## Features` as a standalone italic paragraph beneath the relevant feature.
- Standalone italic paragraphs inside environment features are rendered with the `.flavor` styling.
- `## Design notes` is optional and, when present, is rendered below the card in a separate notes block.

## Structure Rules

Use [templates/structure.template.md](./templates/structure.template.md) as the source of truth for authoring structure.

### File Layout for Structures

- Structures live under `data/structures/tier N/Structure Name/`.
- Every structure folder must include `Main.md`.
- `Main.md` is the only navigable page in the site sidebar.
- Additional Markdown files in the same folder are rendered as segment statblocks below `Main.md` on the same page.
- The build compiles each structure folder into one generated file under `dist/markdown/structures/`.

### Main Frontmatter Rules for Structures

- `tier`: required, accepted values `1`, `2`, `3`, or `4`
- `type`: required text field, such as `colossus`
- `size`: optional text field
- `segments`: optional list, usually written as `list`
- `thresholds`: optional array of exactly two numbers with the first lower than the second
- `stress`: optional non-negative number
- `experience`: optional, plain text or array

### Segment Frontmatter Rules for Structures

- `adjacentSegments`: optional array
- `difficulty`: required, non-negative number
- `healthPoints`: required, non-negative number
- Attack fields are optional, but if one is present, all attack fields must be present: `attack`, `weapon`, `range`, `damage`, and `damageType`.
- `attack`: signed integer string such as `+1` or `-2`
- `range`: accepted values `Melee`, `Very Close`, `Close`, `Far`, `Very Far`
- `damageType`: accepted values `physical` or `magic`

### Body Rules for Structures

- Every file must include a single H1 title.
- `Main.md` may include `## Motives & Tactics`.
- All structure files should use `## Features` with `### Feature Name - Type` headings.
- Feature text may include multiple paragraphs.
- `## Design notes` is optional on `Main.md` and, when present, is rendered below the main structure card.

## Trap Rules

Use [templates/trap.template.md](./templates/trap.template.md) as the source of truth for authoring structure.

### Frontmatter Rules for Traps

- `tier`: required, accepted values `1`, `2`, `3`, or `4`
- `type`: required, accepted values `Harm`, `Snare`, `Debilitation`, `Hazard`, `Disruption`, or `Lockdown` case-insensitively
- `difficulty`: required, non-negative number

### Body Rules for Traps

- The file must include a single H1 title.
- `## Purpose` is rendered as a single summary line.
- `## Features` should use `### Feature Name` headings.
- Each trap feature should use `#### Trigger` and `#### Effect` subheadings.
- Feature text may include multiple paragraphs.
- `## Design notes` is optional and, when present, is rendered below the card in a separate notes block.

## Notes

- Lines starting with `#` inside frontmatter are treated as comments by the build script.
- `dist/` is generated output and can be rebuilt at any time.
- Example reference files may live in `data/`, but the build script skips `EXAMPLE.md`, `EXAMPLE ENVIRONMENT.md`, and `EXAMPLE TRAP.md`.
