# Rust Thanks Card

Generate a badge URL or a standalone SVG card from [Rust Thanks](https://thanks.rust-lang.org/).

## Features

- Self-contained SVG generation inside the action
- `node24` runtime
- Action outputs for rank, contributions, badge URL, SVG markup, and SVG path
- Optional local README marker replacement

## Generate an SVG

```yaml
name: Rust Thanks Card

on:
  workflow_dispatch:

jobs:
  update-card:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - id: rust-thanks
        uses: JohnTitor/rust-thanks-card@main
        with:
          name: "Yuki Okushi"
          format: "svg"
          output-path: "assets/rust-thanks-card.svg"
          avatar-url: "https://avatars.githubusercontent.com/u/25030997?v=4"
          theme: "rust"
```

## Update a README marker block

Add this marker block to your README first:

```md
<!--START_SECTION:rust-thanks-card-->
<!--END_SECTION:rust-thanks-card-->
```

Then run the action with `write-readme: true`:

```yaml
name: Rust Thanks Card

on:
  workflow_dispatch:

jobs:
  update-card:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: JohnTitor/rust-thanks-card@main
        with:
          name: "Yuki Okushi"
          format: "svg"
          output-path: "assets/rust-thanks-card.svg"
          write-readme: "true"

      - uses: stefanzweifel/git-auto-commit-action@v6
        with:
          commit_message: "Update Rust Thanks card"
```

## Inputs

| Name            | Required | Default                | Description                                             |
| --------------- | -------- | ---------------------- | ------------------------------------------------------- |
| `name`          | yes      |                        | A name listed in Rust Thanks                            |
| `format`        | no       | `svg`                  | `svg`, `badge`, or `both`                               |
| `output-path`   | no       | `rust-thanks-card.svg` | SVG output path when `format` includes `svg`            |
| `avatar-url`    | no       | empty                  | Avatar image URL embedded into the SVG                  |
| `title`         | no       | `Rust Thanks`          | SVG headline                                            |
| `subtitle`      | no       | `Contributor stats`    | SVG subheading                                          |
| `theme`         | no       | `rust`                 | `rust`, `light`, or `slate`                             |
| `write-readme`  | no       | `false`                | Replace a local README marker block                     |
| `readme-path`   | no       | `README.md`            | README path to update                                   |
| `readme-marker` | no       | `rust-thanks-card`     | Marker suffix used in `START_SECTION` and `END_SECTION` |

## Outputs

| Name             | Description                              |
| ---------------- | ---------------------------------------- |
| `name`           | Matched name from Rust Thanks            |
| `rank`           | Numeric rank                             |
| `ordinal-rank`   | Ordinal rank such as `1st`               |
| `contributions`  | Contribution count                       |
| `badge-url`      | Generated shields.io badge URL           |
| `svg`            | Generated SVG markup                     |
| `svg-path`       | Absolute path to the generated SVG file  |
| `readme-snippet` | Snippet written into README when enabled |

## License

MIT
