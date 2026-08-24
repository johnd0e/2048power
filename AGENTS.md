# Repository Guidelines

## Project Structure & Module Organization

This is a dependency-free browser game. Entry pages live at the repository root:
`index.html` is classic 2048 and `power.html` is the seeded Power puzzle mode.
Game logic, input, rendering, and small Node utilities are in `js/`. Keep a
test beside its subject as `*.test.js`; for example,
`js/power_game_manager.test.js` and `js/generator_benchmark.test.js`. Styles
are in `style/`, fonts in `style/fonts/`, and static metadata in `meta/`.

## Build, Test, and Development Commands

There is no package manager or build step for JavaScript. Serve the repository
with any static HTTP server and open `index.html` or `power.html`; do not rely
on a bundler. Run the Power smoke test with:

```text
node js\power_game_manager.test.js
```

Run the generator tool's focused test with:

```text
node js\generator_benchmark.test.js
```

Use `node js\generator_benchmark.js --samples 1000 --seed 0` for generator
analysis. See `TESTING.md` for interpretation and larger-sample guidance.

## Coding Style & Naming Conventions

Use ES5-style JavaScript compatible with the existing browser code: constructor
functions and `Prototype.method` assignments, `var` in production game files,
and two-space indentation. Keep lines within the configured 80-column target
where practical. `.jshintrc` enforces camelCase, unused-variable checks, and
other JSHint rules. Name modules in lowercase snake case (for example,
`power_game_manager.js`); name tests `subject.test.js`.

## Testing Guidelines

Add a deterministic regression test for every reproducible bug. Assert visible
or stateful behaviour rather than implementation details. Run the focused test
and the Power smoke test after changing shared puzzle, input, or rendering
logic. Treat benchmark output as comparison data, not a universal performance
threshold.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, such as `Handle cancelled swipe
previews` and `Match swipe preview to finger rotation`. Keep each commit scoped
to one change. Create branches from `master`, not `gh-pages`. Pull requests
should explain user-visible behaviour, list verification commands, link related
issues when applicable, and include screenshots for visual changes. Avoid
unrelated layout or core-gameplay changes; this project deliberately keeps them
conservative.
