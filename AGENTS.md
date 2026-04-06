# AGENTS.md

This file captures repository-specific working agreements for AI coding agents.

## Core Workflow

- Always use Conventional Commits / semantic commits.
- Do not mix unrelated changes in the same commit.
- Prefer small, focused commits.
- Use `npm run deploy` for production deploys.
- When the user says content "can go up" or "can be published/uploaded", treat that as approval to commit the relevant changes, push them to GitHub, and deploy to Vercel.
- Do not deploy or push unrelated local changes without making that explicit.

## Styling Rules

- In SCSS, prefer nesting whenever it keeps the code clear.
- Use the `rem()` SCSS helper instead of writing static `rem` values directly.
- Do not use raw hex colors directly in component styles.
- Define colors as CSS variables first, then consume those variables in styles.
- Do not write padding or margin values directly in component styles when they should be reusable.
- Prefer CSS variables for spacing values used by layout and components.
- Avoid magic numbers when a CSS variable would make the intent clearer.

## Content Rendering Rules

- Environment flavor text lives inside `## Features`, not in a global `## Flavor` section.
- Flavor text in environments is written in Markdown as an italic paragraph like `*text*`.
- Flavor paragraphs should render as `<p class="flavor"><em>...</em></p>`.
- Feature indentation should apply only to the feature lead paragraph, using `.feature-lead`.
- Design notes are optional and should remain documented in templates and contributing docs.

## Repository Conventions

- Preserve the existing visual language of the site unless the task is explicitly a redesign.
- Keep `Home` and `Changelog` content in `public/content/*.md`, not hardcoded in JavaScript.
- When SCSS changes affect the served site, update the compiled CSS output as part of the same change.
- Prefer documenting new authoring conventions in both `CONTRIBUTING.md` and the relevant template files.

## Safety

- Never revert unrelated user changes.
- If there are unrelated modified files, avoid including them unless the user asks.
- If a change has non-obvious side effects, pause and confirm before proceeding.
