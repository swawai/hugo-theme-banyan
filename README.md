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





public/_headers / public/edgeone.json 是 Hugo cache-policy.json  产物，腾讯Edgeone 可能需要拷贝public/edgeone.json 到你项目根目录

### 查看静态资源统计
npm run report:assets

### npm
npm run dev

npm run build

### hugo 基本命令
a 开发，动态构建并指定端口：
    hugo server  -D --port 13241
b 开发，指定地址和访问地址：
    hugo server  -D --bind 0.0.0.0 --port 5120 --baseURL "http://120.233.73.242:5120/"  --appendPort=false --printPathWarnings
c 编译生产版：
    hugo --gc --cleanDestinationDir --minify
d 使用banyan 模板（archetypes 目录下的）创建文章
    hugo new -k banyan content/blog/2026-03-06-asdf.md