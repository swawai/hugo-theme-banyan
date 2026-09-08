# 列表与产品声明

页面的 `list` 只声明子项怎么展示。文章集合的成员来自页面本身的目录或 Hugo 分类关系；选择页的选项由对应布局提供。入口归属继续由真实根页面及有效 `from` 决定，不在文章 front matter 中写菜单。

## 在哪里改表格

| 文件（每种语言分别配置） | 当前声明 | 列出的对象 |
| --- | --- | --- |
| 主题 `content/d/_index.zh.md` | `list: directory` | 目录的直接子目录、文章 |
| 项目 `content/d/wsl/_index.zh.md` | 未声明，继承 `/d/` | WSL 目录的直接子项 |
| 项目 `content/tags/_index.zh.md` | `list: directory` | 现有标签树的子项 |
| 主题 `content/products/_index.zh.md` | `list: directory` | Hugo 的产品分类词项，包含显式空分类 |
| 上述文件的 `cascade`，目标 `kind: term` | `list: products` | 每个分类的 `.Pages`，无需逐类写来源 |
| 主题 `content/all/index.zh.md` | `list: all`、`aggregate: /d` | `/d/` 下全部文章 |
| 主题 `content/all-products/_index.zh.md` | `list: products`、`aggregate: /products` | 产品分类成员的去重并集 |
| 主题 `content/language/index.zh.md` | `list: choice` | `hugo.toml` 已启用的语言 |
| 主题 `content/appearance/index.zh.md` | `list: choice` | 跟随系统、浅色、深色 |

比如要让 WSL 目录使用产品表，在项目 `content/d/wsl/_index.zh.md` 原有 front matter 内加一行：

```yaml
list: products
```

原有 WSL 文章仍全部保留，只把列换成名称、价格、价值说明；没有 `offer` 的文章显示价格 `—`。改成 `list: all` 就使用名称、日期、大小、路径列；改成 `list: directory` 就使用名称、日期、数量／大小列。没有声明时，继承最近内容祖先的 `list`。普通文章仍使用 `article-page`，不会因祖先的列表声明变成列表。

新增普通列表目录时使用 `layout: article-list`、`list: directory` 和需要的 `slots.breadcrumb: true`；位于已有目录下时可继承布局和展示声明。正文只写介绍，表格自动在介绍后出现，旧的 `section-list`、`taxonomy-list`、`all-list`、`products-list` shortcode 已删除。

`aggregate` 只用于汇总入口，指向一个 section 或 taxonomy 根。它不从父目录继承。普通目录和分类页无需写 `aggregate`，也不写 `list_source` 或 `product_filter`。主题默认页面的站点专用修改可通过项目同路径文件覆盖；三种语言各自保留完整 front matter。

## 怎样声明选择列表

语言和外观页面在顶层 front matter 声明 `list: choice`，与 `build.list: local` 是两件事：前者选择行的呈现协议，后者控制 Hugo 是否把页面列入父页面集合。`choice` 使用与其他列表相同的行、图标槽和 `.is-current` 状态，但不排序、不注册 collection 来源，也不参与文章路径。

选择列表的标题由布局传入，作为网格内的 `h1` 列头，保留“系统－语言／系统－外观”。它与目录表共用列头高度、间距和表头横线；共享标题单元格使用 flex 排布，避免文字图标与 SVG 的不同基线撑出额外行高。语言按配置 `weight` 排列，外观按“跟随系统、浅色、深色”排列，列头不显示排序操作或箭头。

选择列表只接受两种原生控件：链接或按钮。共享模板负责文字、图标、选中样式、可访问状态和 `data-*` 输出；页面布局负责提供选项，功能脚本只响应自己的标记。语言项保留真实 `href` 和 `data-language-choice`，无 JavaScript 时仍可切换；外观项使用按钮和 `data-theme-choice`。模板不认识语言代码或主题值，front matter 也不声明脚本文件。

外观的三个子项在 `layouts/_default/appearance-page.html` 中通过 `iconText` 分别使用 `◐`（跟随系统）、`⚪︎`（浅色）、`⚫︎`（深色），以半实心、空心、实心区分，颜色随文字适应明暗主题。浅色／深色使用 `U+26AA`／`U+26AB`，追加 `U+FE0E` 请求文本显示；它们在当前字号下与半圆大小接近，替代部分字体中呈小点的 `○`／`●`。第一列入口使用页面声明的 `icon: theme`，其云月 SVG 定义在 `data/icons.toml`。文字图标复用固定宽度图标槽，并从按钮的可访问名称中排除。

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。可在对应语言参数中设置短文字图标：

```toml
[languages.en.params]
locale = "en_US"
icon_text = "EN"
```

当前站点分别使用 `EN`、`简`、`繁`。未设置 `icon_text` 时回退到主题的语言 SVG；不根据 `en`、`zh-CN` 或 `zh-TW` 猜测国旗或字符。

语言页的选择仍留在设置页；返回原内容时优先打开刚选语言的真实译文。此行为由语言脚本处理，不属于 `choice` 渲染协议，具体规则见 [系统页面与返回](navigation-state.md#系统页面与返回)。

## 怎样收录产品

根项目 `hugo.toml` 注册 `product = "products"`。文章的内容位置、`slug` 和 `/p/.../` 地址保持不变，例如 `content/d/products/xvenv/index.zh.md`：

```yaml
products: [free, first-party]
offer:
  amount: 0
  currency: "$"
  value: "项目级免安装开发环境"
```

至少一个非空产品词项才构成产品收录。词项由作者自由定义，例如 `products: [paid, "$5~$50", "Special Tools"]`，无需改模板或新增分类文件。系统不解释分类含义、不检查互斥，也不从价格推导分类。`offer` 可省略，或只写 `value`；填写 `amount` 时必须提供 `currency`，金额需为非负数字。未标价显示 `—`，价格升序和降序均排在已标价项后；0 显示本语言的“免费”。价值说明缺失时留空。

Hugo 自动生成 `/products/<词项>/`。需要译名、介绍、权重或显式空分类时，再创建项目 `content/products/<词项>/_index.zh.md`，例如：

```yaml
---
title: 自建
weight: 30
---
```

这些是普通分类内容元数据。表格遵循当前列排序，`weight` 不覆盖用户选择的排序。目前项目保留了 free、paid、first-party、third-party 的三语言内容文件，主题中没有固定分类白名单。

## 来源与旧链接

主表、路径列和来源 JSON 共用 `collection/rows.html`；一个列表页只注册一次 `collection` 来源。目录／分类关系适配分别在 `collection/rows-section.html`、`collection/rows-taxonomy.html`，展示在 `collection/render.html`。排序字段由 `collection/config.html` 解析 `list` 后给出，浏览器不按路径或 provider 猜表格种类。

名称比较由 Hugo 执行一次，生成 `sort_name` 数值名次，显示文字仍保留在 `text`。这样首帧、主表与路径列使用同一名称顺序，不因浏览器语言或 ICU 实现不同而换位。日期降序的同日期条目也使用名称降序；升序相反。实现依据见 [Hugo 的稳定排序实现](https://github.com/gohugoio/hugo/blob/v0.157.0/tpl/collections/sort.go)。

`/products/` 现在是分类根，产品全部是 `/all-products/`。项目 `data/redirects.toml` 将旧 `/product-categories/.../` 直接转到新地址，删除与新真实页面重叠的旧规则；`/products/` 本身不重定向。

旧文章书签中的 `from=product-categories/free` 已不再是有效来源；`from=products` 也不能继续代表“全部产品”，因为新分类根只收录分类词项。两者按既有无效来源规则使用文章的真实目录路径，正文仍正常打开，刷新后规则一致。新链接分别携带 `from=products/free`、`from=all-products`。不在运行时增加旧产品命名适配层。系统页不携带 `return`；原生后退恢复历史中的文章网址及其 `from`／排序，回到带旧来源的文章也按上述规则处理。

## 验证

在根项目执行 `node themes/banyan/scripts/checks/check-collections.mjs`。它只向 `temp_workspace/` 写临时内容覆盖层，基于根内容构建三种样式，验证三语言成员不变、继承／覆盖、自动分类、显式空分类、去重、未分类排除、缺失价格及文章进入后的路径顺序。原有浏览器回归继续覆盖画幅、首帧、排序、系统返回和历史导航。
