# CSS 命名、归属与依赖审查

2026-09-10｜基于已完成 6A／6B 的工作区｜审查与实施记录

实施状态：源码与发布结构整理已完成，后续已继续实施本文末尾的“选择器与页面资源收尾”。主题现有 19 个扁平 CSS 源文件；生产构建发布 `page.css`、`prose.css`、`home-brand.css` 和三份语言场景 CSS，共 6 个资源。中段“DOM 类名先保持”的决定仅描述第一轮文件整理；后续原子迁移已替代该阶段的旧类名。

## 结论

建议保留已经收敛的资源装配机制，进一步统一源码命名、合并同一职责的微型文件，并修正少量选择器边界。保持 `assets/css/` 扁平；推荐从 23 个源文件整理为 19 个。文件数是结果，不是目标。

最重要的判断是：**一个文件应该让维护者知道“它控制哪一部分外观”，而不是只告诉维护者“它曾经从哪里拆出来”。**

- `article-*` 的大部分规则实际服务于 `.prose`，包括关于、离线、更新检查及诊断页面的正文，改为 `prose-*` 更准确。
- `collection-list.css` 与 `grid-*.css` 共同组成同一套集合列表，应在 `collection-*` 家族内明确条目、网格和多列表格的分工。
- `theme.css`、`page-shell.css`、`path-navigation.css` 已有清晰职责，应保留。
- 6A／6B 建立的少量稳定发布包、明暗状态源及共享条目机制继续使用。6C 黑白灰仍是后续独立步骤。
- 发布层可再收敛：65 个正文页中已有 50 个需要 rich，合并为一个 `prose.css` 可以删除标签嗅探和诊断页特例；两个不足 110 B 的页面专用产物可保留源码边界、并入 `page.css`。
- 普通正文表格规则会命中 Chroma 行号表，这是本轮唯一确认的选择器正确性问题，应先于纯命名整理修正。

上次针对单个文件提出 `prose-lists.css → article-list.css`，放到全局来看并非最佳方向。更好的统一方向是其他正文组件向 `prose-*` 靠拢；`prose-lists.css` 本身可以保留。

## 实施前的检查范围与事实

读取全部 23 个主题 CSS 源文件、样式装配模板、相关页面入口、列表 SSR 和客户端重绘、主题切换与图标渲染代码，并检查产物契约。忽略 `exampleSite`。根站 `assets/`、`static/` 未发现 CSS 覆盖文件。

- CSS 源码共 32,603 B；没有 Sass／Less，也没有源码内的 `@import` 或 `@layer`。
- 23 个文件都有明确的模板资源引用，没有发现未被装配的 CSS 文件。
- 前轮最终根站构建有 9 个发布 CSS、29,754 B；这不是 23 次浏览器请求。详见 [6A／6B 实施记录](css-review.md)。
- 额外生成的首页场景样式来自模板；它不在 23 个源文件内。
- 最初的审查阶段只新增本文档和临时实验，没有修改 CSS、运行模板或 JS；后续实施与验证结果记录在本文末尾。

临时分析脚本及结果位于根仓库：

```text
temp_workspace/css-structure-review/audit.mjs
temp_workspace/css-structure-review/report.json
```

变量扫描用于定位跨文件引用；变量作用域和模板来源再由人工核对，不能把纯文本扫描当作完整 CSS 依赖分析。

## 实施前的装配路径

```text
content 的 layout
    → layouts/page-*.html + baseof.html
        │
        ├─ baseof 的 styles block
        │    → system-ui/page-styles.html
        │    → 13 个源 CSS → page.css
        │
        └─ 页面入口的 head-extra
             ├─ 有正文 → feature-document/styles.html
             │             ├─ 2 个基础源文件 → article-core.css
             │             └─ 有富内容 → 5 个组件源文件 → article-rich.css
             ├─ 首页 → home-brand.css + 模板生成的场景 CSS
             ├─ 更新检查 → updates.css
             └─ 404 → not-found.css

以上资源 → system-assets/process-css.html
         → 生产 minify → fingerprint → <link rel="stylesheet">
```

开发服务器不做生产 minify，仍有 fingerprint。正文诊断页的代码块由模板直接生成，所以它显式加载 core＋rich；不通过 `.Content` 猜测。集合页只有实际存在正文时才调用正文装配器。语言与外观页直接使用公共页面包。

实施前的源文件顺序：

| 发布包 | 按实际装配顺序的源码 |
| --- | --- |
| `page.css` | theme → core-base → page-shell → article-meta → collection-list → grid-base → grid-table → grid-directory → grid-all → grid-products → core-a11y → core-motion → path-navigation |
| `article-core.css` | article-prose → article-inline |
| `article-rich.css` | prose-lists → article-quote → article-media → article-code → article-table |

这里有三个不同的名字空间，应分别理解：

1. **内容配置**：`list: name / directory / all / products / choice`，表达子项使用的视图。
2. **HTML 类名**：例如 `.grid-list`、`.grid-products`、`.collection-item-link`，连接模板、CSS 和部分 JS。
3. **资源名**：源文件名称，以及最终发布包名称。

例如 `list: products` 由 `feature-browse/collection/render.html` 选择字段并输出 `.grid-products`；浏览器从已经加载的 `page.css` 中取得列宽规则。它没有根据 front matter 临时下载 `grid-products.css`。

因此，合并三个列定义文件不影响三种视图的独立配置；也不需要为了 `choice` 另建 `choice.css`。选择后的操作仍由语言／外观脚本处理。

## 依赖情况：主要已经单向，少数边界仍不清楚

### 配色与尺寸

```text
theme.css 的基础颜色
    → 元素、图标、集合条目、正文组件、首页

page-shell.css 的画幅／列宽
    → 集合列定义、第一列宽度、路径列布局

首页 model.html 生成的场景参数
    → home-brand.css 的位置与动画
```

按变量引用检查，跨 CSS 文件的提供者主要就是 `theme.css` 和 `page-shell.css`；首页另消费模板生成的变量。图片、引用、表格和代码的局部颜色变量已归在各自文件，没有发现正文组件互相读取对方的专属配色变量。

`home-brand.css` 在首页覆盖 `--page-edge-block-end`，属于明确的页面级留白定制，应保留。模板生成的 `--lift`、`--dur`、`--lag` 也是实际使用的首页私有参数，不是未定义变量；可在文件顶部注明来源，不必为局部变量统一加很长的全局前缀。

目前没有 CSS 文件循环加载的问题。需要关心的是**多个选择器命中同一元素时，谁拥有最终规则**，而不只是文件引用图。

### 列表：共享是正确的，文件边界还可以收紧

实施前，`collection-list.css` 同时有条目状态、图标占位、网格列头、路径列头和行宽规则；`grid-base.css` 又处理链接下划线、字号与焦点偏移。

这不是已经失控的依赖，而是两个名字让职责不够直观。例如想调整路径列头，要在 `collection-list.css` 找；想调整选择项按钮的默认外观，也在这个文件找，却必须理解 `.grid-list button.collection-item-link` 的父级约束。

建议分成三个明确对象：

| 建议文件 | 所有者职责 | 不负责 |
| --- | --- | --- |
| `collection-item.css` | 一条可点击／可选择条目的标题、图标占位、链接／按钮默认外观、hover／current 状态 | grid 列数、日期和价格字段 |
| `collection-grid.css` | 单列基底、网格间距、单元格容纳、列头、列头分隔线、网格／路径列的排列差异 | 产品价格或文章时间的数据来源 |
| `collection-table.css` | 多列扩展、日期／计数／价格等单元格、directory／all／products 三种列定义 | 第一列与 choice 的操作逻辑 |

其中 `grid-directory.css`、`grid-all.css`、`grid-products.css` 合计只有 743 B；与现有 `grid-table.css` 合并，约 1.4 KB，保留三段具名选择器即可。它们本来就在同一个渲染器中选择、在同一个包中发布；合并可以减少修改“统一名称列宽”时跳转文件的次数。

前轮保留这些小文件也能正确维护。本轮进一步以“一人维护时修改同一对象要打开几个文件”为标准，推荐合并；不是发现原先存在加载错误。

实施时还应把按钮复位归到条目本身，避免只有放在 `.grid-list` 下面才看起来像统一条目。下划线、focus、current 的优先级应逐条确认；不能通过按文件名字母排序来重新排列整个包。

### 正文：统一 prose，但元信息保持独立

`.prose` 是正文排版作用域；`.article-meta` 是正文之外的可见元信息，两者不是同一层。

- 正文组件统一为 `prose-*`。
- `article-meta.css` 建议连同无行为依赖的 `.article-meta` 一起改为 `document-meta.css`／`.document-meta`，仍随 `page.css` 提供。它对应 `feature-document/meta.html`，表示页面上的日期与 taxonomy；不是 HTML head 中的 SEO metadata。
- `article-inline.css` 中 `.prose code` 的字体同时用于行内代码与代码块，建议移到 `prose-base.css`。行内专有的背景、边框、字号仍留 `prose-inline.css`。这样代码块依赖“正文基础”而不是隐含依赖“行内代码组件”。
- `article-media.css` 目前实际只有图片相关规则和 `<hr>`。将分隔线及 `--media-rule-border` 归回 `prose-base.css`，变量相应正名为 `--prose-rule-border`；图片文件可准确命名为 `prose-images.css`。
- `.md-caption`、`.md-spacer` 可独立出现，继续放在基础正文中，不挪到按需加载的图片包。
- 标题与图片／表格／代码相邻时的间距属于正文流排版，保留在 `prose-base.css`。这是合理的组合关系，不需要为了让文件“绝不互相提及”把它们分散到组件中。

`<hr>` 移入基础包后，还应从 `feature-document/styles.html` 的 rich 判定和 `scripts/checks/check-public-html.mjs` 对应契约中移除该项；只有分隔线的页面将无需 rich 包。不能只移动选择器而让判断逻辑继续表达旧职责。

### 已实验证实：正文表格会影响代码行号表

实施前，`article-table.css` 的 `.prose table`、`.prose :is(th, td)` 也能匹配 Chroma 的 `.lntable`／`.lntd`。`article-code.css` 虽取消了 padding／border，却没有隔离普通表格的全部规则。

使用当前源 CSS 做 Chromium 控制实验，只追加正文表格样式时：

- `.lntable` 的 `display` 从 `table` 变为 `block`；
- `overflow-x` 从 `visible` 变为 `auto`；
- 宽度、颜色、border-collapse 及单元格字号也发生变化。

在临时实验中，给普通表格选择器添加 `:where(:not(.chroma, .chroma *))` 范围约束后，行号表的所测属性与未加载正文表格样式时一致，普通表格的所测属性保持原样。

**这是已确认的选择器交叉，不是已确认的现有文章显示故障。** 当前根站构建未发现 `.lntable` 页面；实验使用控制 HTML 验证作用范围，没有完整测试 Hugo 的各种行号输出。实施时应补一项真实代码行号／正文表格共存的定向回归。

推荐在正文表格一侧排除代码高亮的内部结构，保持边界明确；不靠交换两个文件的加载顺序或追加更多 `.lntable` 覆盖修补。

## 全部文件的实施对应表

单位为实施前源码字节，不是传输大小。下表记录已经完成的迁移。

| 当前文件 | 字节 | 建议位置／名称 | 具体处理 |
| --- | ---: | --- | --- |
| `theme.css` | 460 | 保留 | 全局明暗语义颜色 |
| `core-base.css` | 1,464 | `base.css` ＋ `icons.css` | 元素默认规则留 base；通用图标机制提取 |
| `core-a11y.css` | 260 | 并入 `base.css` | 当前只含全站 skip 链接 |
| `core-motion.css` | 122 | 并入 `base.css` | 当前只调整 body／a 的过渡，紧随默认过渡维护 |
| `page-shell.css` | 1,644 | 保留 | 页面画幅、第一列、slot 尺寸 |
| `path-navigation.css` | 1,287 | 保留 | 路径列追加、sticky、待绘制状态 |
| `collection-list.css` | 4,365 | `collection-item.css` ＋ `collection-grid.css` | 条目与列头／排列规则分开 |
| `grid-base.css` | 1,091 | 并入 `collection-grid.css` | name／choice／表格共享基底 |
| `grid-table.css` | 674 | `collection-table.css` | 多列共有规则 |
| `grid-directory.css` | 134 | 并入 `collection-table.css` | 保留 `.grid-directory` 列定义 |
| `grid-all.css` | 324 | 并入 `collection-table.css` | 保留 `.grid-all` 列定义与路径单元格 |
| `grid-products.css` | 285 | 并入 `collection-table.css` | 保留 `.grid-products` 列定义与价格对齐 |
| `article-meta.css` | 475 | `document-meta.css` | 继续独立于 prose，随 page 包加载 |
| `article-prose.css` | 2,392 | `prose-base.css` | 接收公共 code 字体、hr；保留正文流间距 |
| `article-inline.css` | 1,091 | `prose-inline.css` | 只保留行内专有外观 |
| `prose-lists.css` | 752 | 保留 | 正文 ul／ol／li；与集合列表区分 |
| `article-quote.css` | 1,069 | `prose-quotes.css` | 正文引用块 |
| `article-media.css` | 1,701 | `prose-images.css` | 移出 hr，保留图片及其包装 |
| `article-code.css` | 3,515 | `prose-code.css` | 代码块、Chroma、行号 |
| `article-table.css` | 1,209 | `prose-tables.css` | 普通正文表格，隔离 Chroma 内部表格 |
| `home-brand.css` | 8,047 | 保留 | 首页品牌场景及其独立适配 |
| `updates.css` | 148 | `updates-panel.css` | 明确只有检查更新面板，不负责更新引擎 |
| `not-found.css` | 94 | 保留 | 404 的其他语言链接排列 |

实施后的结构（19 个源文件）：

```text
assets/css/
  theme.css
  base.css
  icons.css
  page-shell.css
  path-navigation.css
  collection-item.css
  collection-grid.css
  collection-table.css
  document-meta.css
  prose-base.css
  prose-inline.css
  prose-lists.css
  prose-quotes.css
  prose-images.css
  prose-code.css
  prose-tables.css
  home-brand.css
  updates-panel.css
  not-found.css
```

不为每个前缀再建一个文件夹。现在文件总量适合扁平查找；若将来某个功能确实发展出多个协作组件，再按真实规模调整。

## 为什么这样合并，又保留另外一些小文件

合并依据是所有权、变化原因和加载边界，不是统一要求文件必须超过多少行。

- skip 链接、默认 transition 和减少 transition 的规则都属于全站基础，在同一处维护更直接。
- 图标已是跨第一列、正文、选择项的实际共享机制，有 SVG／字符／图片／monochrome 四方面的样式，值得从元素默认规则中独立。
- 三种表格列定义由同一个列表渲染器选择、始终一起发布，适合放在一个文件中具名分段。
- 更新面板和 404 各有明确的页面／功能所有者，源码继续独立；发布时可随 `page.css` 一起拼接。两者生产产物只有 107 B 和 66 B，单独加载器与请求的成本已经高于保留它们的价值。
- 约 8 KB 的首页品牌 CSS 同时维护场景、动画、交互，是一个完整组件；当前没有独立复用需求，不按“静态／动画／颜色”机械拆成三个文件。

`base.css` 的边界需要明确：全站元素默认值、基础可访问性和极少量全站辅助规则。现有 `.page-back-link` 的单条间距可以就地保留并注明用途；不为一条规则增加 preferences 样式加载器。如果返回控件发展为真正组件，再独立提取。

## 模板、JS 与发布资源需要一起考虑什么

### 模板保持直接装配

实际修改集中在这些现有装配点，没有新增注册器：

- `layouts/_partials/system-ui/page-styles.html`
- `layouts/_partials/feature-document/styles.html`
- `layouts/baseof.html`
- `layouts/404.html`
- `layouts/page-update-check.html`

整理后删除 `feature-document/styles-core.html`、`feature-document/styles-rich.html` 和 `feature-updates/styles.html`。`baseof.html` 直接调用公共页面样式，不再保留当前无人覆盖、却允许入口意外替换掉 `page.css` 的 `styles` block。

源文件 family 与 partial family 不必机械一一对应。例如页面公共包包含可见元信息 CSS，只是在装配一个资源；不意味着 `system-ui` 要读取或实现文章业务逻辑。

`resources.Get`／Concat 的显式清单已经足够。未来增加组件时，维护对应装配器即可，不为自动发现文件引入目录扫描、动态 import、构建 manifest 或第二套配置。

### 发布包收敛为 page、prose 与首页场景

建议把 `article-core.css` 与 `article-rich.css` 合成一个 `prose.css`；源码仍按正文组件分开。当前 65 个正文页中有 50 个需要 rich，单包会让 15 个纯文本页多取得约 6.39 KB 的 minified CSS，但删除渲染后 HTML 标签嗅探、`prefetchdebug` 显式补包和 core／rich 顺序契约，更符合本站的低心智维护优先级。

页面公共包继续叫 `page.css`，并拼入仍各自维护的 `updates-panel.css` 与 `not-found.css` 源码。首页继续使用公共 `home-brand.css` 加语言场景 CSS；三份场景当前内容完全相同，但未来模型允许按语言变化，为节省 2,992 B 建立内容键去重机制并不划算。

这属于名称迁移：更新引用和 `check-public-html.mjs` 的产物契约后，不保留旧文件、双加载或重定向。仅改源码文件名并保持内容、顺序、输出目标不变时，最终拼接字节可保持相同；改变输出 basename 时，即使内容 hash 相同，资源 URL 也会改变，浏览器会重新取得新地址。移动规则或修正作用范围则会正常改变内容 hash。

实际从 9 个发布 CSS 收敛为 6 个：page、prose、首页公共样式和三个首页场景。单页最多加载三个，其中普通列表页只加载 page，正文页加载 page＋prose，首页加载 page＋home brand＋对应场景。

### DOM 类名先保持现有契约

文件名和 HTML 类名无需逐字相同。`collection-grid.css` 中保留 `.grid-list`，依然容易理解。

这些类还承担真实行为连接：

- `path-navigation-ui.js` 创建 `.collection-item-*`、`.grid-list`、`.path-column`。
- `sortable-grids.js` 通过 `.cell-title .collection-item-link` 找条目。
- `canvas-position.js` 通过 `.collection-item-link` 判断列表进入动作。
- 更新 UI 找 `.collection-item-title`，主题脚本设置 `.is-current` 与 `data-theme`。

因此不在 CSS 整理中附带批量更名 `.article`／`.grid-*`／`.collection-*`，也不全量迁移到 `data-*`。若以后决定变更这层接口，应同时修改 SSR、客户端重绘和行为测试，作为单独的语义迁移。

`.article-meta` 是一个有限例外：检索确认只有样式与 `feature-document/meta.html` 使用，没有 JS 行为查询；它可以与文件一起原子改为 `.document-meta`，不会牵动列表协议。

## 不应随本轮重做的部分

- 不给语言、外观、文章全部、产品全部各做整套页面 CSS。它们通过共享样式形成统一 UI，页面入口只负责选择与装配。
- 不恢复按页面组合产生多种 CSS 包，也不拆成每个正文组件各一次请求。
- 不新建 CSS 框架、全局样式注册器或为了分层而加入 `@layer`；当前主要问题用明确命名和作用范围即可解决。
- 不把所有正文组件颜色重新搬回一张全局变量表。组件专属变量留在组件内，只消费全局语义颜色。
- 不把“所有规则之间没有任何联系”当作解耦目标。统一列宽、正文基础字体与相邻元素间距，本来就需要协作。
- 保留大画幅、路径列、overflow、sticky 和首页组件自己的 58rem 适配；这些不是待清理的旧响应式布局。
- 首页的 reduced-motion 静态方案、代码高亮灰阶化属于后续体验与配色验收，不能借结构整理偷偷改变。

## 实施顺序与验证结果

本次作为 6C 之前的 **6B 补充整理**，与黑白视觉变更分开验收。

1. **装配契约已收敛。** `baseof` 直接加载 page；正文统一为一个 prose 包；updates／404 源码进入 page 包。产物检查已同步，旧 partial 和 rich 标签嗅探已删除。
2. **源码命名与归属已统一。** 基础全站规则、icons、三个 collection 文件、code 字体与 hr 均已归位；`hugo.toml` 的旧文件注释已修正。
3. **正文表格边界已修正。** 普通表格选择器排除 `.chroma` 内部结构，新增 `prose-table-chroma-isolation-contract` 回归。该场景在旧产物上失败，在新产物上通过。
4. **根站验证已完成。** 6C 可在这套稳定结构上独立进行。

验证针对实际变化：

- 根站生产构建与 `check-public-html`：引用无缺失／重复、全站 page 地址唯一、每个 `.prose` 页面恰好加载一个 prose 包、无 `.prose` 页面不加载它，并拒绝页面加载未知 CSS 或发布目录遗留无人引用的 CSS。
- 同一批亮／暗页面比较：第一列、路径列、name／choice、多列表格的字号、列宽、选中／hover／focus；正文的标题、列表、图、引用、代码、普通表格和元信息。
- 行为抽查：排序后进入文章、返回及横向位置恢复，语言与外观的选择、更新面板操作。
- 代码行号边界：在正文页中按 Hugo／Chroma 的 DOM 契约注入行号表夹具，让它与普通正文表格共存，并核对普通表格样式不会改变行号内部结构。当前根站内容没有自然生成 `.lntable` 的页面。
- 如仅改名的阶段内容相同，可用产物字节比较缩小回归范围；归并和作用域修订完成后，再跑与这些行为对应的既有回归。

最终生产构建位于 `temp_workspace/public/2609101030-css-structure-final`：Hugo 196 页，141 个 HTML 检查通过，CSS 资源为 6 个；图片交付、agent readiness、导航状态和集合契约通过。完整浏览器回归 42／42 通过，报告位于 `temp_workspace/regression/260910100846-browser/report.json`。产物检查还用负向夹具确认会拒绝未知引用和无人引用的 CSS。6A／6B 的既有结论继续有效，本轮补充完成了命名、装配与 Chroma 表格边界的收口。

## 选择器与页面资源收尾（2026-09-10）

用户要求继续完成前述清单，不能停在全站弹窗移除。本轮在相同开发分支实施以下内容，仍属于 6B 收尾，未进入黑白配色。

### CSS 作用范围与名称

- `base.css` 移除全站 `a:hover` 透明度，避免图片链接和正文链接一起变淡；跳转正文控件改为 `.skip-link`。
- `collection-grid.css` 与 `collection-table.css` 移除数据格的 `pointer-events: none`，恢复普通文本选择与原生 title 提示的命中区域；列表链接仍只占名称列，不扩大成整行链接。
- `.collection-panel` 负责一列宽的容器，`.collection-list` 负责网格，`.collection-cell` 负责单元格，变体统一用 `collection-*` 修饰。列头高度、行高、间距与分隔线位置集中在列表局部变量中。保留既有几何，不重新调整画幅。
- 正文元信息使用 `.document-meta__row`、`__label`、`__separator`，删除泛化的 `.label`／`.sep` 和重复日期／分类样式；移除无消费者的 `root-navigation`、`slot-row`、`collection-item-icon-svg` 样式类。
- `prose-inline.css` 使用 `overflow-wrap: anywhere` 处理长 URL，正常单词按常规断行；`prose-lists.css` 移除列表项的 `break-all`。末尾引用仅取消底部间距，保留它与前文的距离；默认字体、列表显示和图片尺寸重复声明收回各自唯一规则。

没有按“全站加载”给所有文件加 `base-` 前缀。基础默认值集中在 `base.css`；图标、画幅、正文和列表保留明确的组件职责。源码仍为 19 个文件，发布仍为 6 个 CSS，没有新增框架或样式注册器。

### DOM 与行为一起迁移

排序原来通过 `cell-` 类名前缀辨认数据格、排除 `.header`；这会让视觉改名影响真实行为。现在明确读取 `data-collection-cell`、`data-collection-header`、`data-collection-entry` 和 `data-sort-indicator`。SSR、动态路径列、主列表排序与画幅点击跟踪同时迁移，不提供旧类名别名。

保留 `data-sort-*`、`data-prefetch-slot`、公开 URL 与集合数据格式的原有含义；不因为类名整理重做整个浏览协议。修改样式的维护者现在无需依靠一个隐藏的类名前缀约定来保护排序。

### 设置页与全站运行逻辑

| 资源或逻辑 | 加载范围 | 原因 |
| --- | --- | --- |
| `preferences/language-page.js` | 语言页 | 点击已由 Hugo 输出的译文链接、替换当前设置页历史记录 |
| `preferences/language-return.js` | 全站 main | 返回原页面时消费一次语言选择，兼容 BFCache |
| `back-links.js` | 语言／外观／我的／检查更新页 | 仅这些页面包含返回控件；语言和更新页直接导入，另两页直接装配 |
| `preferences/theme.js` 与主题首屏初始化 | 全站 | 首屏配色、跟随系统、跨标签页与 BFCache 同步都有跨页需求；小型控件处理不再另建状态协议 |
| `sw-manager.enable.update.js` | 启用 SW 的页面 | 注册、后台检查、waiting／激活和缓存生命周期 |
| `updates/page.js`，含 `updates/ui.js` | 检查更新页 | 版本、按钮与本地化状态文案只用于此页 |
| `updates-panel.css` 与返回链接间距 | 公共 page.css | 样式很小，保持稳定公共缓存，不为几条规则新增请求 |

语言列表的名称、图标、href 与选中状态只由 Hugo 输出一次；删除全站重复的 `data-language-context`。返回原内容使用页面已有的标准 hreflang 链接，并核对发布域名；在预览服务器上使用同一路径的本地地址。一次性会话记录 `banyan:language-return` 保持语言代码字符串，供缓存中的旧页面直接读取；可选的 `{code, name}` 单独保存在 `banyan:language-return-label`，只在代码匹配时提供显示名称，两项均在返回或普通导航时消费。记录不含阅读 URL。旧 `return` 参数不再有清理分支，只作为未知参数被忽略。

更新页通过现有 `window.BanyanServiceWorkerManagerRuntime.updates` 连接引擎：`subscribe(listener)` 立即提供 `{status, latencyMs}` 并订阅变化，返回取消函数；`check()` 检查或应用待更新版本。这是两者实际需要的接口，不是通用事件总线。删除全站 `data-site-update` 镜像、没有消费者的 `data-theme-preference` 和主题自定义事件；更新 UI 用自己的 `data-site-update-action-label` 找按钮文字，不借用样式类。

### 本轮验证

- 两份生产构建：`temp_workspace/public/2609101149-ui-contract-from`、`temp_workspace/public/2609101151-ui-contract-to`。后者 141 个 HTML 审计、图片交付、导航与 agent readiness 检查通过；三语言四种列表的成员、继承、排序、时间与图标契约通过（`temp_workspace/collection-contract-aICFGj`）。
- 完整浏览器矩阵共 47 个场景，初次 44 个通过；失败的旧 `.skip` 测试引用和两条更新等待断言已修正。针对键盘及全部相关 PWA 行为补跑 9 个场景，全部通过。两份报告为 `temp_workspace/regression/260910115114-browser/report.json` 与 `temp_workspace/regression/260910115618-browser/report.json`，合并覆盖 47 个场景。
- 等待问题经 worker 日志与本地 Playwright 实现确认：`waitForFunction` 将异步谓词返回的 Promise 视为真值。改用已有 `pollUntil` 等待浏览器查询的完成值；首次导航 HTML／CSS／JS 预缓存也使用此实际等待条件。未改产品引擎来迎合测试时序。
- 三项 CSP／SW 导航预加载检查通过，报告为 `temp_workspace/regression/260910115743-browser-security/report.json`。确认 navigation 按版本 cache-first、指纹资源 cache-first、sw.js 不入缓存且响应为 `no-cache, max-age=0, must-revalidate`；激活更新后清除旧 navigation 缓存。
- 另用本轮改造前的真实产物 `temp_workspace/public/2609101124-no-prompts-to` 升级到本轮产物，检查更新与首页进入更新两条路径均通过，确认旧页面及其缓存也能正常完成迁移（`temp_workspace/regression/260910115953-browser/report.json`）。
- 新增用例去掉列表样式类后仍能排序并正确进入文章；逐页核对 8 个真实页面的脚本加载边界；检查长 URL、末尾引用和链接 hover。已查看浅色更新目录、深色外观和移动布局截图，统一行高、列宽、选中态与横向画幅均保持。

下一阶段为原计划的 6C：黑白灰颜色与相关视觉验收。本轮不改正文插图、不新增账户能力，也不继续扩展 CSS 命名层级。
