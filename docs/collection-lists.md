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
| 主题 `content/site/_index.zh.md` | `list: directory` | 站点目录的直接子项：关于、更新记录、微信等真实页面 |
| 主题 `content/language/index.zh.md` | `list: choice` | `hugo.toml` 已启用的语言 |
| 主题 `content/appearance/index.zh.md` | `list: choice` | 跟随系统、浅色、深色 |

比如要让 WSL 目录使用产品表，在项目 `content/d/wsl/_index.zh.md` 原有 front matter 内加一行：

```yaml
list: products
```

原有 WSL 文章仍全部保留，只把列换成名称、价格、价值说明；没有 `offer` 的文章显示价格 `—`。改成 `list: all` 就使用名称、更新时间、大小、路径列；改成 `list: directory` 就使用名称、更新时间、数量／大小列。没有声明时，继承最近内容祖先的 `list`。普通文章仍使用 `article-page`，不会因祖先的列表声明变成列表。

新增普通列表目录时使用 `layout: article-list`、`list: directory` 和需要的 `slots.breadcrumb: true`；位于已有目录下时可继承布局和展示声明。正文只写介绍，表格自动在介绍后出现，旧的 `section-list`、`taxonomy-list`、`all-list`、`products-list` shortcode 已删除。

`aggregate` 只用于汇总入口，指向一个 section 或 taxonomy 根。它不从父目录继承。普通目录和分类页无需写 `aggregate`，也不写 `list_source` 或 `product_filter`。主题默认页面的站点专用修改可通过项目同路径文件覆盖；三种语言各自保留完整 front matter。

站点目录与 `/d/` 一样声明 `layout: article-list`、`list: directory`，完整复用相同模板、集合来源、排序及路径列。目录中只有真实子项，没有追加的版本、检查、状态或返回按钮；全站骨架、公共样式装配和根导航均不再识别 `site_update`。

PWA 状态是主题 `content/site/pwa/index*.md` 的真实子页，声明 `layout: pwa-page` 和 `slots.breadcrumb: true`，在目录中和关于、微信一样显示、排序、选中。该子页的布局直接装配更新操作并加载所需样式，`site_update` 文案与更新记录引用也由该子页提供；更新引擎保持独立。语言、外观页的返回按钮分别由各自布局明确调用，不由全站骨架追加。

站点根与既有子页通过 `slots.breadcrumb: true` 启用路径列，目录的 `cascade` 同时为未声明 `slots` 的新子页提供默认值。已有子页自行声明了 `slots`，需在原 map 内加入 `breadcrumb: true`，不能期待父级 cascade 自动补进该 map。

## 站点信息与 RSS

RSS、GitHub 和备案信息都使用普通 `article-page`，不新增外链条目类型、跳转布局或列表分支。它们声明 `build.list: local`、`slots.breadcrumb: true`，作为站点目录的真实子页参与排序和路径导航，但不进入全站文章 RSS。

| 实体文件（三语言） | 内容职责 |
| --- | --- |
| 主题 `content/site/rss/index*.md` | RSS 订阅说明，正文调用 `{{< rss-link >}}` |
| 主题 `content/site/github/index*.md` | 默认的 Banyan 仓库说明；项目可同路径覆盖 |
| 项目 `content/site/github/index*.md` | Swaw 的 GitHub 主页说明与链接 |
| 项目 `content/site/icp/index*.md` | 本站备案号与工信部查询链接；主题不存放业务备案信息 |

`layouts/shortcodes/rss-link.html` 直接读取当前语言 `Site.Home.OutputFormats.Get "RSS"`，输出可点击的相对地址和可复制的绝对订阅地址。地址来自 Hugo 实际输出，不手写 `/zh/index.xml`，不复制 RSS 数据；使用该 shortcode 时首页需在 `[outputs].home` 启用 RSS。GitHub 和备案链接直接写在 Markdown 正文中，用户进入说明页后自行点击。

微信继续使用已有 `content/site/wechat/`。共用页脚只保留原来的品牌主页链接及其 `brand_label`、`aria_label` 配置，移除微信、RSS、GitHub、备案和关于的旧页脚渲染分支；首页及其他使用该 fragment 的页面同步生效。品牌文字和年份暂不调整。

## 统一更新时间

目录、分类、全部文章和路径列的时间统一读取 Hugo `.Lastmod`，列名为“更新时间”。文件显示自身更新时间；非空目录／分类汇总其包含文章的最新更新时间，目录递归到后代文章，树形分类也包含下级分类。空目录使用自身 `.Lastmod`，空分类及其他没有有效时间的条目显示 `—`，排序值为空。

项目 `hugo.toml` 已启用 `enableGitInfo = true`，并配置 `[frontmatter] lastmod = ["lastmod", ":git", ":default"]`：显式 `lastmod` 优先，其次由 Hugo 取 Git 提交时间，最后使用 Hugo 的默认日期来源。无需为了列表补造 `date`；需要手动控制更新时间时，在文章 front matter 写 `lastmod: 2026-09-08T18:00:00+08:00`。

显示和排序取同一 `.Lastmod`；显示到日，排序保留到秒。既有 `sort=date-asc/desc` URL 键保持不变，含义统一为更新时间，产品表仍只有名称、价格、价值说明三列。正文中的发布日期继续使用 `.Date`，不改变其含义；PWA 状态页中的版本时间仍是构建时间。

## 怎样声明条目图标

SVG 名称来自 `data/icons.toml`，字符使用 `icon: { text: "©" }`；两者都使用同一个 `icon` 值，不根据引号或是否命中图标库猜测类型。内容支持三个字段：`icon` 指定自己被列出时的图标，`list_icon_folder`／`list_icon_file` 分别指定本列表中的目录或分类／文章的默认图标。例如主题 `content/products/_index.zh.md` 可以声明：

```yaml
icon: product
list: directory
list_icon_folder: folder
list_icon_file: product
```

`icon` 只描述该入口本身，不按同名字段继承。条目未声明 `icon` 时，由列出它的列表提供默认值；两个 `list_icon_*` 字段分别沿当前列表的真实祖先取最近的非空声明，最终默认为 `folder`／`file`。省略或空白表示继承，明确写 `folder`／`file` 可以覆盖祖先设置。条目自己的非空 `icon` 始终优先，SVG 名称去除首尾空白并统一为小写；字符对象只允许一个非空字符串 `text`，保留大小写，按纯文本输出。`list_icon_folder` 与 `list_icon_file` 同样接受 `{ text: "…" }`，继承时整体替换，不把文字与 SVG 合并。

主题现在在 `content/products/_index*.md` 和 `content/all-products/_index*.md` 各声明 `list_icon_file: product`，产品分类子页继承分类根的设置，不需要逐篇给产品文章写图标。Xvenv 未写 `icon`，因此在产品分类和产品全部中显示包裹，在目录、标签和全部文章中仍显示文件；如果希望所有入口一致，在 Xvenv 各语言文件中声明 `icon: product` 即可。

`aggregate` 只提供集合成员，不参与默认图标继承；`/all-products/` 与 `/products/` 是兄弟入口，所以各自声明一次。普通文章只允许 `icon`；目录、分类及主题支持的列表布局可以声明子项默认值，包括以 `index.md` 实现的 `/all/`。误把 `list_icon_*` 配在普通文章上，或填写未定义的图标名称，构建会报错并指出页面和字段。第一列将首页自身与直属入口一起渲染，使用首页的目录默认值或条目自身的 `icon`。根项目 `content/_index*.md` 声明 `linkTitle: "2026 Swaw"`、`icon: { text: "©" }`、`weight: 5`；访问首页只选中首页，其他页面仍按真实入口或有效来源选中。旧版权页脚、顶部重复首页链接及 `slots.footer` 已移除。

图标值由 `icon/resolve.html` 校验，`icon.html` 统一输出文字或 SVG；浏览器用 `icon-value.js` 保留同样的值结构，JSON 编解码不得把字符对象转成字符串。默认值实现集中在 `list/icon-defaults.html`（解析列表默认值）和 `list/item-icon.html`（自身声明优先）。`collection/rows.html` 为每行写入最终 `icon`，主表、来源 JSON 和路径列共用；站点列表、第一列及首页快捷列表也调用相同规则。`entry-source/register-icons.html` 只收集本页可用来源和祖先列依赖的图标，连同实际静态渲染的图标按需打包，不在每页固定预装一组图标。CSS、浏览器选择／排序逻辑和现有列表数据协议不变。

## 怎样声明选择列表

语言和外观页面在顶层 front matter 声明 `list: choice`，与 `build.list: local` 是两件事：前者选择行的呈现协议，后者控制 Hugo 是否把页面列入父页面集合。`choice` 使用与其他列表相同的行、图标槽和 `.is-current` 状态，但不排序、不注册 collection 来源，也不参与文章路径。

选择列表的标题由布局传入，作为网格内的 `h1` 列头，保留“系统－语言／系统－外观”。它与目录表共用列头高度、间距和表头横线；共享标题单元格使用 flex 排布，避免文字图标与 SVG 的不同基线撑出额外行高。语言按配置 `weight` 排列，外观按“跟随系统、浅色、深色”排列，列头不显示排序操作或箭头。

选择列表只接受两种原生控件：链接或按钮。共享模板负责文字、图标、选中样式、可访问状态和 `data-*` 输出；页面布局负责提供选项，功能脚本只响应自己的标记。语言项保留真实 `href` 和 `data-language-choice`，无 JavaScript 时仍可切换；外观项使用按钮和 `data-theme-choice`。模板不认识语言代码或主题值，front matter 也不声明脚本文件。

外观的三个子项在 `layouts/_default/appearance-page.html` 中通过 `icon` 分别引用 `appearance-auto`、`appearance-light`、`appearance-dark`，图形定义在 `data/icons.toml`。三个 SVG 使用相同的 `16×16` 画布、圆心、半径和描边，分别呈半实心、空心、实心，避免 Unicode 字体回退造成尺寸不一致。颜色继承 `currentColor`，复用现有 `1rem` 图标槽及按需 sprite；图标不参与按钮的可访问名称。第一列入口继续使用页面声明的 `icon: theme` 云月图标，语言项使用相同的 `icon: { text: "…" }`，不再传递 `iconText`。

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。可在对应语言参数中设置短文字图标：

```toml
[languages.en.params]
locale = "en_US"
icon = { text = "EN" }
```

当前站点分别使用 `EN`、`简`、`繁`。未设置 `icon` 时回退到主题的语言 SVG；不根据 `en`、`zh-CN` 或 `zh-TW` 猜测国旗或字符。

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

名称比较由 Hugo 执行一次，生成 `sort_name` 数值名次，显示文字仍保留在 `text`。这样首帧、主表与路径列使用同一名称顺序，不因浏览器语言或 ICU 实现不同而换位。更新时间降序中时间相同的条目也使用名称降序；升序相反。实现依据见 [Hugo 的稳定排序实现](https://github.com/gohugoio/hugo/blob/v0.157.0/tpl/collections/sort.go)。

`/products/` 现在是分类根，产品全部是 `/all-products/`。项目 `data/redirects.toml` 将旧 `/product-categories/.../` 直接转到新地址，删除与新真实页面重叠的旧规则；`/products/` 本身不重定向。

旧文章书签中的 `from=product-categories/free` 已不再是有效来源；`from=products` 也不能继续代表“全部产品”，因为新分类根只收录分类词项。两者按既有无效来源规则使用文章的真实目录路径，正文仍正常打开，刷新后规则一致。新链接分别携带 `from=products/free`、`from=all-products`。不在运行时增加旧产品命名适配层。系统页不携带 `return`；原生后退恢复历史中的文章网址及其 `from`／排序，回到带旧来源的文章也按上述规则处理。

## 验证

路径数据文件由各语言首页发布，直接使用当前语言来源模型的 `current_collection_items`，不在默认语言首页重新构建所有语言的数据。这样页面内嵌数据与后续请求的 `_items.json` 完全相同，避免中文主表使用中文排序、路径列却使用默认语言排序。浏览器回归 `system-site-directory` 覆盖根项目的七个真实子项、三语言列表几何、排序、进入后的路径顺序和刷新／历史恢复，同时验证首页普通入口、无页脚、信息页停留与目标链接、RSS 地址及 XML 内容。

在根项目执行 `node themes/banyan/scripts/checks/check-collections.mjs`。它只向 `temp_workspace/` 写临时内容覆盖层，基于根内容构建三种样式，验证三语言成员不变、继承／覆盖、自动分类、显式空分类、去重、未分类排除、缺失价格及文章进入后的路径顺序。时间用例覆盖发布日期与更新时间不同、只填更新时间、默认日期来源、完全无时间、目录／平面与树形分类汇总，以及升降序进入文章后的路径顺序。图标用例覆盖两种默认值独立继承、局部与自身覆盖、汇总入口独立性、首帧菜单、来源专用 SVG、刷新及前进后退，并确认非法声明使构建失败。原有浏览器回归继续覆盖画幅、首帧、排序、系统返回和历史导航。
