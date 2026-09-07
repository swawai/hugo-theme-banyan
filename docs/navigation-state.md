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
2. 构建产物层
   - 为每个 collection 生成 `_items.json`
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

### `return`

`return` 是系统页面返回阅读现场的同源地址，包含原来的路径、查询参数和锚点。
在语言、外观、我的、站点之间切换时保留原地址；系统页面仍选中自身入口。
它不参与 collection lineage，也不替代 `from`。语言设置读取原页面的静态翻译
关系后，将原查询参数和锚点带到对应翻译页；缺少翻译时先确认，再去目标语言首页。

系统链接的 `href` 在导航状态改变时同步更新，而不是等用户左键点击时再修正。
两种集合排序完成 URL 更新后发出 `banyan:navigation-state-change`；系统链接还响应
`hashchange`、`popstate` 和 `pageshow`。这样中键打开、复制链接也能保留最新状态。
排序仅替换 URL，保留已有 `history.state`，不覆盖该次访问的其他状态。

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

## `_items.json`

每个 collection 会生成一份 `_items.json`。

它是当前唯一导航数据协议，替代了历史上的 `_children.json`。

它承担：

- 当前 collection 的 item rows
- provider
- logical path
- sort variant
- default sort

它不承担：

- 多层排序状态
- 当前页面是否打开了某个 dropdown
- 当前页面是否处于 wide browser mode

也就是说：

- `_items.json` 是“单层 collection 事实源”
- `from/sort/sorts` 是“当前页面运行时状态”

## `collection_source`

breadcrumb 中每一层 item，都应该能追溯到它所属的 collection source。

要区分两件事：

- `item.href`
  - 点这个 crumb 自己会去哪
- `collection_source.logical_path`
  - 这个 crumb 的兄弟菜单应从哪一层 collection 取

这两个不是一回事。

例子：

- crumb `Products`
  - `item.href = /d/products/`
  - 但它的菜单来自 `/d/`

这就是为什么不能仅从最终 breadcrumb HTML 反推菜单语义。

## 当前主路径

当前已统一成：

1. 真实根页面列表提供第一列；canonical breadcrumb/source model 提供 root item、levels 与 collection source
2. fragment 发布只产 `_items.json`
3. runtime 通过 `_items.json + from/sort/sorts` 组装 breadcrumb menus

entry 页与 collection 页虽然仍有不同的 orchestration，但它们共享：

- items payload 解码
- sort token 解释
- row -> href 生成
- breadcrumb menu item 组装

## 布局边界

调整宽屏分栏或后续统一横向画幅时，继续沿用当前边界：

- `_items.json` 仍是单层 collection 数据源
- `from/sorts` 仍是当前页面路径状态
- slots 不负责承载 browser 状态

也就是说，wide browser mode 应是：

- 现有导航语义和运行时状态的一个新视图

而不是：

- 再发明一套新的 collection 协议
- 或把状态塞进 `slots`
