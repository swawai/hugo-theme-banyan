# Banyan Navigation State

## 目的

这份文档只说明一件事：

- 当前 breadcrumb / collection browser 相关状态，应该如何理解
- 哪些是页面语义
- 哪些是运行时视图状态
- 哪些是构建期产物

它不是产品说明，而是后续维护时的“协议与边界备忘录”。

## 核心判断

当前导航体系分成 3 层：

1. 页面语义层
   - 当前页面在真实内容结构中属于哪个根入口
   - breadcrumb 各层分别对应哪个 collection
2. 页面数据层
   - 当前页面把可进入来源的当前层与祖先层 collection payload 内嵌一次
3. 运行时状态层
   - 当前从哪条路径进入：`from`
   - 当前 collection 的排序：`sort`
   - 当前路径上每层冻结排序：`sorts`

不要把这 3 层混在一起。

## URL 状态

### `from`

`from` 表示 entry 页是沿哪条 collection 路径进入的。

例子：

```txt
?from=d/products
```

含义：

- 当前页是 `xvenv`
- 它是从 `/d/products/` 这一层点进去的

`from` 只表达来源 collection lineage，不表达当前 entry，也不表达排序。
当前 entry 由页面路径表达，例如 `/p/xvenv/`。因此
`from=d/products/xvenv` 不是有效的新协议状态。

只有当前页面发布的来源集合才是有效 `from`。不能根据一个任意字符串的
前缀推断来源；不存在或不属于当前页面的来源使用内容祖先的默认选中项。
第一列始终保留完整根页面列表，`from` 仅调整选中状态和后续路径列。

### 系统页面与返回

语言、外观、我的、更新使用普通页面链接，不携带 `return`，也不另行存储原阅读地址。
语言切换留在对应语言的设置页；系统页面始终选中自身入口。

`assets/js/preferences/back-links.js` 为 `data-page-action="back"` 提供原生历史后退行为，只随使用返回控件的页面加载。
“返回”每次后退一条记录；连续访问多个设置页时也逐页返回。
语言页内切换语言使用 `location.replace()`，替换当前设置页的历史记录。
例如“文章 → 中文语言页 → 英文语言页 → 中文语言页”只保留“文章 → 中文语言页”，
返回按钮与浏览器后退均一次回到进入语言设置前的页面，不逐个经过语言选择。
新标签页没有上一条记录时，使用链接自身的 `href` 回到当前语言首页。
文章的路径、`from`、排序和锚点仍属于其自身历史记录，不再复制到系统页面。

在语言页明确选择语言后，页内 `preferences/language-page.js` 用当前标签页的
`sessionStorage["banyan:language-return"]` 只记录语言代码字符串（例如 `zh`），保持缓存中旧页面的读取约定。
显示名称单独放在 `banyan:language-return-label` 的 `{code, name}` 中，仅当其代码与本次选择一致时使用。
附加名称缺失或无法读取不影响返回；没有匹配名称时，缺少译文的提示使用语言代码。
全站 `assets/js/preferences/language-return.js` 在首个非语言页恢复时
立即消费代码与附加名称：历史恢复（含 `pageshow.persisted` 的 BFCache 恢复）使用本页
Hugo 已输出的 `link[rel="alternate"][hreflang]` 打开所选语言版本，普通导航只清除记录并尊重链接本身的语言。
译文跳转使用 `location.replace()`，保留查询参数与锚点，不增加历史记录；
目标页继续按既有协议校验来源和排序。没有译文时保留原内容并显示说明。
不同语言的段落及锚点可能不同，不保证正文滚动位置逐像素一致。

这条一次性记录不保存网址，也不使用全局语言偏好强制改写页面；移除自动语言推荐后，`preferred_lang` 不再读写：
没有本次选择时，打开英文书签、原生后退和其他标签页保持原本地址。
会话存储不可用时，语言链接和原生返回仍然可用，但无法跨页面传递这次返回语言。

页面不再定义或处理 `return`；旧网址中若残留此参数，与其他未知参数一样被忽略。没有 URL 清理兼容层，也不会把参数传播到语言选项。原阅读网址仍由浏览器历史保存。

语言选项、地址和选中状态由 Hugo 一次输出，浏览器仅处理用户点击。所有页面不再重复附带 `data-language-context`；返回说明保留为一个本地化文本属性。SEO 翻译链接以发布域名输出，返回时核对其与 canonical 同源，再使用路径在当前服务域名下打开，确保本地预览也正常。

### `sort`

`sort` 表示当前页面的活动 collection 排序。

例子：

```txt
?sort=name-asc
```

它只服务当前页主 grid/header controls，也会同步投影到从该主列表离开的导航链接上。
breadcrumb 分栏不读取或改写 `sort`。

### `sorts`

`sorts` 表示当前进入路径上，每一层 collection 的冻结排序。

例子：

```txt
?from=d/products&sorts=name-asc,date-desc
```

含义：

- `/d/` 这一层按 `name-asc`
- `/d/products/` 这一层按 `date-desc`

注意：

- `sorts` 按路径层级位置对齐
- 它不是全站排序
- 它只对当前 `from` lineage 有意义
- breadcrumb 分栏排序只改写自己对应的 slot；不会联动主列表 `sort`
- 当路径上的排序都等于对应 collection 的默认排序时，URL 应省略
  `sorts`；只有出现非默认排序时才写入完整 lineage，必要时用 `_`
  保持层级占位。

## 内嵌 collection payload

每个页面的 `data-entry-breadcrumb-sources` 只包含该页面实际可进入的来源。每个来源携带当前层的 `current_collection_items`，各祖先 level 携带自己的 `collection_items`。

两处都使用同一种紧凑 row payload 协议。页面加载后在输入边界解码一次，路径列初始呈现和列内排序共用这份内存数据，不再生成或请求 `_items.json`／`_children.json`。

生产检查将单页解码后的 `data-entry-breadcrumb-sources` 限制为 64 KiB。这个上限约束每页实际携带的来源、层级与 row 总量；集合页自身的 HTML 预算则按“固定外壳 + 每条 row”计算，正常新增内容不会因为固定总量阈值而误报。

它承担：

- 当前 collection 的 item rows
- provider
- logical path
- sort variant
- default sort

它不承担：

- 多层排序状态
- 页面列的显示或隐藏状态
- 页面画幅的滚动位置

也就是说：

- Hugo collection model 是构建期事实源，browser source 是当前页面需要的可序列化投影
- `from/sort/sorts` 是“当前页面运行时状态”

## `collection_source`

breadcrumb 中每一层 item，都应该能追溯到它所属的 collection source。

要区分两件事：

- `item.href`
  - 点这个 crumb 自己会去哪
- `collection_source.logical_path`
  - 这个 crumb 的兄弟条目应从哪一层 collection 取

这两个不是一回事。

例子：

- crumb `Products`
  - `item.href = /d/products/`
  - 但它所在列的兄弟条目来自 `/d/`

`item.column_items` 是按上述来源生成的可见列条目；不能仅从当前项目的链接反推整列来源。

## 当前主路径

当前已统一成：

1. 真实根页面列表提供第一列；canonical breadcrumb/source model 提供 root item、levels 与 collection source
2. browser source 随 HTML 输出当前层和各祖先层的紧凑 row payload
3. runtime 在页面边界解码一次，通过内存 payload + `from/sort/sorts` 组装路径列的 `column_items`

entry 页与 collection 页虽然仍有不同的 orchestration，但它们共享：

- items payload 解码
- sort token 解释
- row -> href 生成
- breadcrumb column item 组装

## 布局边界

当前所有宽度共用横向画幅，布局调整继续沿用以下边界：

- 页面内嵌 payload 是本页路径列唯一的浏览器数据输入
- `from/sorts` 仍是当前页面路径状态
- slots 不负责承载 browser 状态

路径列只有一种呈现方式，不再按宽度或 `variant` 选择不同菜单。`column_items` 的同一协议贯穿 Hugo 静态输出和浏览器同步呈现；没有并行的 preview／fragment 重绘，也没有保留旧 `menu` 字段兼容读取。第一列没有 `data-prefetch-slot` 生产者，因此预取配置也不再保留 `menu` 类别。
