# Rust Thanks Card

Generate a card/badge from [Rust Thanks](https://thanks.rust-lang.org/).

## Workflow config

```yaml
name: Rust Thanks Card

on:
  workflow_dispatch:

jobs:
  update-card:
    name: Rust Thanks Card
    runs-on: ubuntu-22.04
    steps:
      - uses: JohnTitor/rust-thanks-card@main
        with:
          name: 'Yuki Okushi' # A name on Thanks
          image_url: 'https://avatars.githubusercontent.com/u/25030997?v=4' # An image URL to be used in a SVG
          type: 'badge' # badge or svg
```

## Examples

### SVG

<img src="https://cardivo-woad.vercel.app/api?name=Rust%20Contribution%20Stats%0A&description=Contributions%F0%9F%93%9D:%201441%20%20%20%20Rank%F0%9F%8F%86:%2033&image=https://avatars.githubusercontent.com/u/25030997?v=4&backgroundColor=%23ecf0f1&disableAnimation=true" width="400">

### Badge

<img src="https://img.shields.io/badge/Rust%20Contributions-1441%20contibutions,%2033rd-orange?logo=rust" width="400">

## License

MIT
