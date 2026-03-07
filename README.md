# Banyan Theme for Hugo

A minimalist, multi-language, and highly customizable theme for Hugo.

## Installation

Inside your Hugo project root, clone this theme into the `themes` directory:

```bash
git clone https://github.com/swawai/banyan.git themes/banyan
```

## Setup (Crucial Step)

Due to Hugo's configuration merging rules, structural configurations like `[outputs]`, `[outputFormats]`, and `[taxonomies]` **must** be defined in your site's root configuration file. They will not be inherited from the theme.

To use all features of the Banyan theme, **you must copy the provided example configuration to your root directory**:

```bash
cp themes/banyan/exampleSite/hugo.toml ./hugo.toml
```

Once copied, open your root `hugo.toml` and customize the `baseURL`, `title`, and site descriptions to match your needs.

## Features

- Built-in multi-language switcher (English, Simplified Chinese, Traditional Chinese)
- Dark / Light / Auto mode toggle
- Advanced custom output formats (sort by name/size/date/count)
- Minimalist CSS architecture

## License
MIT
