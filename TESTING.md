# Testing

## Testing approach

This project uses deterministic automated tests to protect observable gameplay
behaviour. Every reproducible regression gets a focused assertion, and relevant
tests are run before a change is considered ready.

Tests and performance analysis have different purposes. A test has a clear
pass/fail expectation. A benchmark measures generator cost and output
characteristics; its results are compared with a baseline rather than against a
universal timing threshold. For a meaningful comparison, use the same command,
seed range, machine, and Node.js version.

## Project tests

### Power gameplay smoke test

The Power smoke test exercises the puzzle rules, state restoration, touch input,
preview behaviour, and UI-facing game state.

```text
node js\power_game_manager.test.js
```

### Generator benchmark test

The focused benchmark test checks the collision grouping and tile-composition
reporting used by the generator analysis script.

```text
node js\generator_benchmark.test.js
```

## Generator testing

`js/generator_benchmark.js` measures the cost and output characteristics of
the seeded Power puzzle generators without changing game state. It uses the
same 32-bit unsigned seed conversion as the Seed input in `power.html` and can
run each ruleset independently.

Run a reproducible sample with:

```text
node js\generator_benchmark.js --samples 5000 --seed 0
```

Options:

- `--samples <count>` — number of consecutive seeds to generate (default: `1000`).
- `--seed <seed>` — first 32-bit seed in the sample (default: `0`).
- `--mode <classic|gravity|push|all>` — ruleset to analyze (default: `classic`).
- `--json` — print the complete report as JSON for further processing.

Seeds are canonicalized with a mode prefix: `c` for Classic, `g` for Super
Gravity, and `p` for Push to Merge. For example, `c123`, `g123`, and `p123`
share a numeric seed but intentionally produce different boards. Numeric input
uses the currently selected mode. Use `--mode all` to compare all three
generators over the same numeric range.

The Seed input converts its value with `Number(value) >>> 0`; it therefore
addresses the unsigned 32-bit seed space. A benchmark range uses consecutive
values from `--seed` and is directly representative of manually entered seeds.

The report contains:

- total, average, p50, p95, and maximum generation times;
- solution-search calls per puzzle, rejected-result count, and invalid-result count;
- distributions for minimum solution length, tile count, total tile value, and
  individual tile values;
- exact initial-board collisions between distinct seeds, including each board
  and its colliding seeds;
- the ten most frequent tile multisets.

`Invalid results` must remain zero: every returned puzzle must meet the
configured move and tile-count bounds and must not contain floating tiles.
`Rejected results` count seeds for which all generator attempts were rejected;
those calls return `null` and never substitute a fixed puzzle. A non-zero count
deserves separate inspection because it means the requested sample contains
seeds without a generated result.

The generator also rejects puzzles that can be solved using rotations in only
one direction. For Push to Merge, this check simulates rotations only; stack
pushes are deliberately excluded from that filter.

A collision is an exact match of the complete initial board for two or more
distinct seeds. `Duplicate results` counts repetitions beyond the first board;
`Collision groups` counts the distinct repeated boards. The listed seed groups
and boards make every reported collision reproducible.

`Solution minimum moves` describes generated difficulty. `Tile count`, `Total`,
`Tile values`, and `Tile composition` describe output variety. These are not
expected to be uniform: use them to spot unexpected shifts after changing the
generator, and compare them against a recorded baseline for the same seed range.
