# CSS 审查与黑白主题实施计划

2026-09-10｜`codex/flatten-navigation`｜6A／6B 与结构补充实施记录，6C 待办

本次工作对应[导航展平计划](navigation-flattening-plan.md)的第 6 步。6A／6B 及后续 CSS 命名与装配整理已实施，保留当前明暗配色；6C 黑白灰化尚未实施。下面的审查发现以改造前的基准代码为准，不代表这些问题仍未解决。

2026-09-10 补充：用户进一步要求检查 CSS 命名与引用结构，见 [CSS 结构审查](css-structure-review.md)。报告中的主路径已经实施：源码职责收敛为 19 个扁平文件，公共页面与正文分别只发布一个稳定包；本文件记录当前结果，结构审查保留决策依据。

## 6A／6B 第一轮实施结果（阶段记录）

- 新增 `theme.css` 与 `page-shell.css`，颜色、元素默认样式、画幅各有归属；删除无差异的 rail／path 尺寸转发。
- 保留棕色强调外观，`--focus`／`--focus-text` 正名为 `--accent`／`--accent-text`；次要文字使用 `--muted`，键盘焦点使用独立 `--focus-ring`，`color-scheme` 跟随最终 `data-theme`。首页蓝色只在首页组件内定义。
- root／path／choice 共享条目状态；链接、按钮与代码行号链接的键盘轮廓由同一基础规则提供。路径列不再覆盖共享选中颜色。
- 新增 `grid-table.css` 收纳真正的表格规则。`article-base.css` 已删除；正文组件的专属变量与选择器归各自文件，caption／spacer 因为可独立使用而留在正文基础中。
- 页面发布一个稳定 `page.css`；正文只在实际需要时加载固定 `article-core.css` 和 `article-rich.css`。元信息是页面 slot，随基础包提供，不要求页面必须有正文。诊断页显式取得 core＋rich，修复模板生成代码块的漏载。
- CSS 的无用途 PostProcess 已通过 Hugo 实际产物等价实验后删除。样式 hash 与生产 minify 保留。

生产产物对比：

| 指标 | 改造前 | 6A／6B 第一轮 |
| --- | ---: | ---: |
| CSS 文件数 | 22 | 9 |
| 全部 CSS 文件字节（minify，未 gzip） | 88,360 B | 29,754 B |
| 页面基础包种类 | 5 | 1 |
| 正文 core／rich 包种类合计 | 11 | 2 |
| 没有 prose 却加载正文 core 的页面 | 69 | 0 |
| 有 pre 但漏载 rich 的页面 | 1 | 0 |

单页冷加载并非全部减少：语言／外观的 CSS gzip 合计从 3,660 B 降为 2,565 B，产品分类子页从 3,917 B 降为 2,565 B；首页增加 243 B，“关于”增加 615 B。WSL 文章减少 38 B，Xvenv 增加 200 B。选择少量稳定包后，跨页面访问复用相同 URL，且装配规则更直接。此处只比较字节与缓存地址，没有把它宣称为网络耗时实测。

真实页面对比使用浅色／深色各 10 条路由，检查画幅、正文、标题、图片、引用、表格、代码、元信息的首个对应元素。除诊断页获得原本缺少的代码外观外，所测几何、颜色、间距一致。完整明细与截图位于根仓库 `temp_workspace/css-6ab-visual/comparison.json` 及同目录。

验证完成：

- 最终生产构建 `temp_workspace/public/2609100304-css-6ab-final`，Hugo 196 页，141 个 HTML 产物检查通过；CSS 为 9 个、29,754 B。
- 三语言集合完整契约通过：`temp_workspace/collection-contract-sfZ4uX`；导航、图片交付与 agent 发布检查通过。
- 40 项既有浏览器回归通过，涵盖桌面／触摸画幅、滚动恢复、来源与排序、语言返回及 PWA 升级：`temp_workspace/regression/260910025923-browser/report.json`。该次运行的新增交互测试在颜色 transition 完成前取样，产生一次测试误报；改为等待元素真实 transition 完成后，定向运行通过：`temp_workspace/regression/260910030201-browser/report.json`。
- 最终收回 10 处重复 `styles` override 后，141 个 HTML 的 CSS 链接顺序与之前一致，9 个 CSS 逐字节一致。最终首页、列表对齐和明暗交互 3 项定向检查全部通过：`temp_workspace/regression/260910030518-browser/report.json`。新增产物断言保护无 prose 多载、模板 pre 漏载及公共 CSS 地址稳定性。
- 独立集成 review 未发现剩余阻断或实际回归。此次未改文章正文、产品数据、主题切换脚本或 PWA 缓存策略。

## 6B 结构补充实施结果（当前）

- `assets/css/` 保持扁平，共 19 个源码文件。元素默认样式、skip link 和 reduced-motion 归入 `base.css`，图标显示归入 `icons.css`；不再保留宽泛且很小的 `core-a11y.css`、`core-motion.css`。
- 列表源码收敛为 `collection-item.css`、`collection-grid.css`、`collection-table.css`：分别负责条目状态、公共网格和多列表格。服务端、浏览器重绘与测试共用 `.collection-list` 及其 `--directory`、`--all`、`--products` 变体；行为通过明确的 `data-collection-*` 属性连接，不再借类名前缀推断。
- 元信息由 `document-meta.css` 独立负责。正文使用 `prose-base.css`、`prose-inline.css`、`prose-lists.css`、`prose-quotes.css`、`prose-images.css`、`prose-code.css`、`prose-tables.css`；普通表格选择器明确排除 Chroma 行号表，避免正文表格规则穿透代码组件。
- 七个正文源码固定合并成一个 `prose.css`，只由真正输出 `.prose` 的入口加载；不再扫描正文标签决定 core／rich 组合，也不要求模板生成代码块的页面手动拼两个包。
- `baseof.html` 直接加载公共 `page.css`，不再提供所有页面重复继承的默认样式 block。`updates-panel.css`、`not-found.css` 保留靠近功能的源码归属，但一并进入 `page.css`，删除两个微型发布入口。

| 当前指标 | 结果 |
| --- | ---: |
| 扁平 CSS 源文件 | 19 |
| 公共页面包 | 1 个：`page.css` |
| 正文包 | 1 个：`prose.css` |
| 完整生产构建的 CSS 资源 | 6 个：公共、正文、首页基础、三语言首页场景 |

这里的“源码文件”和“发布资源”是两个维度：源码按修改职责拆分，Hugo 再按跨页缓存边界合并。首页场景按语言执行模板，因此三个场景资源仍各自发布；没有为减少计数而增加跨语言聚合协议。

## 结论

现有 CSS 可以在保留大画幅布局、共享列表和原生链接／按钮的基础上收敛。重点是明确颜色和交互状态的所有者，减少正文组件之间的覆盖，以及复核样式装配成本。文件数量本身不是主要问题，不需要重新建立 CSS 框架，也不需要给语言、外观各建一套样式。

审查时主题有 21 个 CSS 源文件，共 34,587 B；6A／6B 第一轮为 23 个、32,603 B；当前为 19 个扁平源码并发布 6 个 CSS。源码按职责拆分，发布文件按缓存复用组织。`collection-grid.css` 是 name、choice 与多列表格的共同网格，`collection-table.css` 集中 directory、all、products 的字段和列定义。主页面已没有小／中／大三套切换规则。

## 检查范围与证据

- 读取主题 CSS、列表与正文模板、主题脚本、SVG 图标库及样式装配器；忽略 `exampleSite`。
- 基准代码：主题 `d50c9b6`，项目 `e564401`。使用此前通过验证的根站生产构建 `temp_workspace/public/260910-layout-structure-final`。
- Chromium 实测首页、语言、外观、产品分类子页和 WSL 文章，每页检查浅色／深色，共 10 个页面状态。测量结果与截图在根仓库 `temp_workspace/css-review/`。
- 这是定向审查，未重复运行完整回归，也没有把 Chromium 的表现推断为所有浏览器表现。

## 改造前确认的问题与决策依据

### 1. 同一个颜色变量承担了互不相同的职责

改造前的 `core-base.css` 中，`--focus` 同时用于键盘焦点、列表选中态、文章标题、引用、表格、代码背景、首页风向袋和 SVG 文件图标。`--link-visited` 同时用于已访问链接和日期、计数、说明、表格正文、代码注释。

例如，只想改变“已访问链接”的颜色，目前还会改变产品价格和更新时间。只想加深键盘焦点，目前还会改变文章标题和首页动画。这是黑白化前最应解决的耦合。

建议把页面背景、正文、次要文字、分隔线等基础颜色集中到 `theme.css`；组件仅从这些基础颜色派生自己的表面与状态。已访问链接与次要文字在规则中区分，即使默认使用相同的灰色。最终删除旧的多用途 `--focus`、`--focus-text` 和只供首页使用的全局 `--accent-secondary`，同步更新 SVG 与首页局部映射，避免保留两套颜色入口。

### 2. 路径列覆盖了共享的选中态文字颜色

改造前的 `collection-list.css` 前段规定 `.collection-item-link.is-current` 使用 `--focus-text`，末段的 `.collection-list--column .collection-item-link` 又设置 `color: var(--link)`，覆盖了路径列的当前项颜色；`:visited` 分支还有更高的选择器优先级。

实测 `/zh/products/free/`：第一列“产品－分类”的当前文字是棕色，路径列“价格－免费”是正文黑色。深色下同样分别为浅棕色和近白色；两者背景、尺寸相同。当前统一主要落实在外形上，状态仍有两处所有者。

建议默认行颜色、hover、current、focus-visible 只在共享条目规则中定义。grid／column 变体只处理排布和列头，不再重设状态颜色。第一列、路径列、主列表、choice 都消费同一组状态。

### 3. 链接与按钮的键盘焦点没有完整统一

改造前的 `core-base.css` 只为 `a:focus-visible` 设置轮廓；`grid-base.css` 虽同时匹配链接和按钮，却只设置 `outline-offset`。

实测语言选项是 `2px dashed` 的站点轮廓，外观选项是浏览器默认的 `1px auto`。截图中 Chromium 的默认轮廓可见，不能根据 computed style 中的轮廓颜色单独判定它不可见；已确认的是外观依赖浏览器默认绘制，与语言列表不一致。

建议为共享条目的链接和按钮声明同一焦点轮廓；当前项表示所在位置，焦点表示键盘下一步操作对象，两者要能够同时辨认。保留按钮的原生语义，不修改语言和外观各自的操作脚本。

此外，浅色和深色页面的 `color-scheme` 实测均为 `normal`。应随已有 `data-theme` 明确声明 `light`／`dark`，让浏览器原生控件、滚动条采用对应方案。该属性的职责见 [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)。不再另建一份主题判断逻辑。

### 4. 正文组件的样式归属不够集中

原 `article-base.css` 集中了图片、引用、表格、行内代码、代码块的所有配色，并包含重复的深色赋值；各组件文件只消费它。修改代码块时，需要同时理解 `article-base.css`、`article-inline.css`、`article-code.css`。

具体可以收敛的地方：

- `article-prose.css` 中的图片包装、图片链接、caption 等规则，应与 `article-media.css` 对照归位，避免图片尺寸与间距分散两处。
- `article-inline.css` 的 `.prose code` 同时命中代码块，随后 `article-code.css` 撤销背景、边框等。将行内专属外观限定为真正的行内代码，字体等共性再明确共享。
- 表格、引用、媒体、代码的专属颜色变量放回对应组件；全局只保留跨组件确实共用的基础颜色。
- `article-prose.css` 针对“标题接图片／表格／代码”等组合有较多单独间距规则。它们影响已发布文章的排版，应以实际文章样例收敛，不直接批量删除。
- `.article` 的宽度借用了 `--page-shell-min-inline`，虽然目前都是 100%，但正文容器与页面画幅不是同一个概念，应解除这条不必要的关联。

### 5. 基础样式与表格特有规则混在一起

改造前的 `grid-base.css` 除单列 grid 外，还包含日期／计数颜色、计数右对齐、单位宽度及表格滚动规则。name 与 choice 虽然不会渲染这些字段，却需要穿过这些规则才能理解基底。

建议单列布局与所有列表共用的列头留在基底；共享的表格单元格规则放在清晰的表格部分，必要时收成一个 `grid-table.css`。directory／all／products 的专有列定义仍保留在对应文件。先以实际共享程度决定是否拆文件，不按每种字段各建文件。

`collection-list.css` 和 `grid-base.css` 还反复设置、取消链接下划线及 `border-bottom`。其中“防止 prose 链接边框穿透”的注释对应的旧规则已经不在当前正文 CSS 中，适合连同冗余声明复核清理。

### 6. 样式装配同时存在多载与漏载

[`feature-document/styles.html`](../layouts/_partials/feature-document/styles.html) 总会输出正文基础包，再通过 `$ctx.Content` 内的标签判断是否追加代码、图片等组件。它与页面真正渲染的结构存在偏差：

- 全部 141 个 HTML 中，134 页加载正文基础包，**69 页实际没有 `.prose`**，仍加载 5,396 B 的 `article-core.no-meta`；包括语言、外观和许多列表页。只有 65 页确实有正文。
- `prefetchdebug/index.html` 的模板直接输出 7 个 `.prose > pre`，但它们不在 Markdown 的 `.Content` 中，因此没有加载代码样式。全站扫描确认这是此次产物中唯一有 pre 却缺少代码 CSS 的页面。该问题影响诊断页的呈现，是明确的漏载，不需要新建通用资源注册框架来修复。

建议将 `.article` 的极少量通用容器规则移到页面基础中，让真正渲染正文的入口明确加载正文样式。集合页依据是否渲染正文决定；直接生成代码块的诊断页明确取得对应样式。调整时保留 `.Content` 已有 shortcode 渲染过程，避免改变其资源登记时机。

### 7. 组合包反复复制公共 CSS

改造前产物共 22 个 CSS、88,360 B，主要组成如下。这里是生产 minify 后的文件字节，不是 gzip／Brotli 传输量，也不是首屏网络耗时。

| 产物 | 数量 | 合计 | 观察 |
| --- | ---: | ---: | --- |
| 页面 `bundle-*` | 5 | 46,669 B | 每个包含相同的 8,372 B 基底 |
| `article-core` | 2 | 11,165 B | with-meta／no-meta 只差 373 B |
| `article-addon` | 9 | 19,430 B | 图片／代码／引用等 5 种特征形成不同组合 |
| 首页场景、首页基础、更新、404 | 6 | 11,096 B | 有独立的实际用途 |

这些 URL 各自有 hash，单个文件能长期缓存，但跨入口／跨文章可能下载大部分相同、URL 却不同的 CSS。源码拆分合理，不代表发布时也需要排列组合。

建议 6B 比较两个低成本候选：

1. 一个稳定的 `page.css`，打包共享基底、路径规则和三个很小的 grid 变体；按现有组件推算约 10,247 B。相对现有页面包，单页冷访问增加约 438–1,875 B，却可减少约 36 KB 的全站重复产物，跨视图共用一个缓存地址。需以实际构建验证，不宣称已有性能收益。
2. 正文使用一个稳定基础包；富内容需要时加载一个完整 `article-rich.css`。现有完整组件组合仅 3,866 B，可换掉当前 9 种 addon 组合。简单图片文章的单次字节会增加，因此对比“第一次打开简单文章”和“连续浏览多篇文章”后决定。不要拆成每页额外请求 1–5 个微型组件文件。

当时优先考虑保持少量稳定粗粒度包，源码仍按职责组织。首页静态样式与语言场景数据分别发布有真实用途；第一轮仍让 `updates.css` 独立发布，后续结构审查比较其模板与请求成本后，改为以 `updates-panel.css` 保留源码归属并随 `page.css` 发布。

`system-assets/process-css.html` 的生产分支还调用 `resources.PostProcess`。目前未发现 CSS 依赖 PostCSS、构建后统计或后处理占位符；可做产物等价实验，确认后删除这一步。Hugo transform 已有缓存，不再套一层自建缓存。

### 8. 可以明确收回的旧规则

- `article-base.css` 的 `.article .article-dates` 已无法匹配。当前日期只出现在独立的 `.slot-meta`，其样式已由 `article-meta.css` 所有，应删除旧块。
- `core-motion.css` 的 `html::before` 在当前 CSS 中已没有基础规则；`core-a11y.css` 的 `.sr-only` 在主题模板、脚本及根站产物中无使用，清理时可收回。
- 路径条目重复的 min/max-width、overflow／ellipsis，以及产品表重复的 title 单元格 pointer-events，可保留唯一声明。
- `article-quote.css` 的链接 `border-bottom-color` 没有对应边框；与前述旧防穿透声明一起收回。
- `--page-rail-inline`／`--path-column-inline` 只是统一列宽的转发，`--path-columns-gap-inline` 只是统一间距的转发。当前目标已明确各列统一，可以直接消费共同尺寸，减少无实际差异的中间名。

CSS 类仍被排序与路径脚本用作部分查询条件。没有发现当前 SSR 与动态 DOM 失配；清理不能按“没有 CSS 规则”就删除 `.path-column-link` 等行为标记，也不在本轮全量迁移到 `data-*`。

## 应保留的机制与边界

- 大画幅、固定导航列宽、路径列追加、sticky、横向滚动相关规则是当前交互的主体。整理不能改变已有列的位置或重新自动滚到最右。
- [`home-brand.css`](../assets/css/home-brand.css) 的 `58rem` 媒体查询仅调整首页场景的宽度与留白，不是旧的全站响应式模式。保留组件自己的适配。
- 代码块和正文表格仍需要处理自身溢出；不要因为页面允许横向滑动，就机械删除所有局部 overflow。
- 图标已经支持 SVG、字符和资源图片。图标库中的 file／folder／product 改用 `currentColor` 等中性表达即可；不新增第四种图标协议。
- 首页选中链接已有下划线，选中按钮主要靠颜色和透明度，灰阶化时给按钮补充非颜色的选中标记，保持可辨认。
- 已声明 `monochrome: true` 的图片图标继续使用现有黑白显示规则；正文图片、二维码、备案图片、浏览器 favicon 不自动加全站灰度滤镜。
- `prefers-reduced-motion` 目前只降低过渡，首页漂移动画仍在运行，实测 reduce 下动画名及 92s／192s 等周期保持。若优化，需要设计静态但仍可见的首页场景；直接移除动画会让初始 `opacity: 0` 的条目消失。这是单独的体验调整，不混入无视觉变化的整理。
- Chroma 的行号、行高亮等样式对应受支持的代码块能力，不能仅因这次抽样页面没有使用就判定为死代码。
- Chroma `.lnlinks` 保留链接语义并继承全局键盘轮廓，代码组件只把轮廓向内偏移，避免裁切。

## 当前文件职责

保持 `assets/css/` 扁平结构。CSS 按视觉职责复用；`baseof.html` 直接装配公共资源，输出正文的入口明确装配正文资源，不为每个页面入口复制 CSS。

| 文件或文件组 | 负责什么 |
| --- | --- |
| `theme.css` | 明暗基础配色、浏览器 `color-scheme` |
| `base.css` | 元素默认样式、全局排版、焦点、skip link 与 reduced-motion |
| `icons.css` | 通用 SVG／文字／图片图标尺寸、对齐、单色显示及 sprite 容器 |
| `page-shell.css` | 页面、第一列、主区尺寸和整体画幅 |
| `path-navigation.css` | 路径列对页面主体的扩展 |
| `collection-item.css` | 条目、图标占位、链接／按钮 reset 与统一交互状态 |
| `collection-grid.css` | `.collection-list` 单列基底、列头和路径列行结构；行为由独立的 `data-collection-*` 标记连接 |
| `collection-table.css` | 多列表格字段、滚动及 directory／all／products 列定义 |
| `document-meta.css` | 正文外的日期与分类元信息 slot |
| 七个 `prose-*` 文件 | 正文基础、行内、列表、引用、图片、代码、表格；共同发布为 `prose.css` |
| `home-brand.css` | 首页品牌场景的静态呈现；场景参数仍按语言单独生成 |
| `updates-panel.css`、`not-found.css` | 功能自己拥有的呈现源码；随公共 `page.css` 发布 |

这个划分让“改列宽”“改选中背景”“改代码块”“改深色文字”各有清晰位置。Hugo 装配边界只有公共 `page.css`、按需 `prose.css` 与首页资源；无需引入多层目录、CSS 框架、通用样式注册器或 CSS `@import`。

## 黑白灰的具体范围

建议页面、文字、导航、列表、控件及首页装饰收敛到黑白灰。灰色继续承担次要文字、层次和分隔，选中与焦点还有背景、描边、下划线等形态区别。

颜色按用途组织，避免建立几十级全局灰阶编号。第一版建议控制为 `--bg`、`--fg`、`--muted`、`--border`、`--link`、`--link-visited`、`--focus-ring`。链接与正文、已访问与次要文字可以默认同色，但允许各自表达语义。列表的 hover／current 从基础色派生，组件自己的浅背景也由组件管理。

代码语法高亮目前另有蓝、紫、绿、棕等颜色，单改强调色不会消除。应在 6C 独立核对代码阅读效果：若一并灰阶化，继续保留 Chroma 分类、粗体／斜体和层次，不能把所有 token 当普通正文。正文插图的内容颜色不属于主题配色。

## 分步实施与验收

1. **6A（已实施）：基础职责与交互状态收敛。** 配色、画幅、条目状态和键盘焦点已归位。
2. **6B（已实施）：正文与样式装配减负。** 局部变量归位，多载／漏载与死规则已处理；后续结构补充统一了 19 个源码的命名与边界，改用唯一 `page.css` 和唯一按需 `prose.css`，完整构建只发布 6 个 CSS。此次用户一起授权 6A／6B，因此合并交付验收。
3. **6C（待确认后实施）：黑白灰视觉验收。** 统一基础色、SVG 图标、首页装饰和正文组件，独立核对代码高亮、图片边框及各交互状态，确认后结束原计划第 6 步。

每步按影响范围验证：根站生产构建和产物检查；实际亮／暗／跟随系统；第一列、主列表、路径列、choice 的默认／hover／current／键盘焦点；排序、进入文章、返回、刷新和横向位置；窄屏触摸与桌面；包含图片、长链接、引用、表格、代码和元信息的真实文章。仅在涉及对应能力时扩展测试，不以自动生成大量选择器快照代替行为验证。
