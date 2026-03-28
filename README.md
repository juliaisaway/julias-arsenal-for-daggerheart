# Adversaries and Environments for Daggerheart

Repository for the custom adversaries I create for my Daggerheart games.

## Structure

`data/`
Source files written in Markdown with frontmatter.

`dist/`
Generated output. This folder is recreated on every build.

`scripts/build.mjs`
Simple build script that renders every adversary into the `EXAMPLE.md` presentation format inside `dist/`.

## Adversary format

Each adversary lives in its own `.md` file, for example:

```md
---
tier: 2
role: standard
difficulty: 13
thresholds: [7, 18]
healthPoints: 5
stress: 3
attack: +1
weapon: Fangs
range: Melee
damage: 2d8+5
damageType: physical
experience: Voracious +2
---

# Silkwing Strider

Short description.
```

## Commands

Install is not required right now because the project has no dependencies.

```bash
npm run build
```

Build output includes:

- `dist/markdown/**`: rendered Markdown files with frontmatter transformed into the display layout

To remove generated files:

```bash
npm run clean
```

## Workflow

1. Add a new `.md` file under `data/adversaries/`
2. Follow the template in `templates/adversary.template.md`
3. Run `npm run build`
4. Use the files in `dist/` for any future site, app, or publishing pipeline

