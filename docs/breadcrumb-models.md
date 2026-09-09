# Banyan Breadcrumb Model

## 第一列与进入路径

第一列是当前语言站点的真实根页面列表，由 `navigation/root/pages.html` 构建：
`Home.Pages` 与直接属于 Home 的 taxonomy 根页面取并集，再按页面 `weight` 排序。
名称取 `LinkTitle` / `Title`，地址取 `RelPermalink`。只有显式声明 `root_nav: true` 的根页面才显示，`build.list: local` 的系统页面也可以参与。

首页自身作为普通根入口，使用版权文字与字符图标。页面不声明主菜单归属，也没有独立的菜单项目白名单。
新增入口时，创建真实的根页面并设置 `root_nav: true`、名称和权重；新增某个入口的子项时，把它放在相应内容目录中。

## 选中规则

`navigation/root/selected.html` 从当前页面及真实内容祖先中找根入口，提供静态 HTML 的默认选中项。
公开 URL 可以与内容路径不同，因此不能根据 URL 前缀猜所属入口。例如 `content/d/products/xvenv/` 发布在 `/p/xvenv/`，仍属于真实目录；目录隐藏时第一列不选中。`content/updates/changelog/` 保留 `/changelog/` 地址，同时归属“更新”并显示其路径列。

有效的 `from` 指向当前页面已发布的来源集合。预览与运行时根据该来源的 `root_item` 调整第一列选中项，完整入口列表始终保留。
从“标签”进入同一篇文章就选中“标签”，从“产品－全部”进入就选中“产品－全部”。不存在或不属于当前文章的来源不参与选中，继续使用内容祖先。
系统页面选中自己的根入口，使用普通页面网址；返回按钮使用浏览器历史记录，不另存原阅读地址。语言选择后的返回行为见 [navigation-state.md](navigation-state.md#系统页面与返回)。首页作为显式根入口时选中自己；没有根入口祖先的内部页不强制选中一项。

## 路径模型

`navigation/path/model.html` 根据普通页面、首页或 taxonomy 的真实结构构建模型：

- `root_item`：第一列应选中的根页面。
- `tail_items`：根页面之后的路径项目。
- `levels`：各路径项目及其所属集合。
- `schema_items`：结构化数据中的页面路径。

项目自身的 `href` 与提供兄弟条目的 `collection_href` 含义不同。例如“WSL”项目指向 `/d/wsl/`，其兄弟列表来自 `/d/`。`collection_label` 取该所属页面的名称，用于没有排序 provider 的静态列头。
每个路径项目的 `column_items` 保存该列要显示的兄弟条目；没有兄弟条目时，渲染器只显示项目自身。它是普通列数据，不含展开、隐藏或下拉状态。

可见路径列由 `path-navigation-ui.js`／`path-navigation.css` 实现，使用 `renderPathColumns()` 与 `renderPathColumn()`；结构模型和 SEO BreadcrumbList 仍属于 breadcrumb。行选中状态统一使用 `current`，不再接受 `highlighted` 或 `selected` 别名。完整命名约定见 [UI 命名与职责](ui-naming.md)。

`navigation/path/section-items.html` 和 `navigation/path/taxonomy-items.html` 分别查找真实父目录与分类父级，通过 `navigation/path/items-from-rows.html` 把条目转换成统一的 `text`、`href`、`current`、`title`、`kind`、`icon` 字段。调用方已经提供统一行结构，不再另传字段名称。

`navigation/source/page-model.html` 将这些层级映射到集合 provider 与 `_items.json`。所有列表页统一使用 collection 来源，排序字段由 `list` 声明决定。主列表、路径列与来源 JSON 共用 `collection/rows.html`。若浏览器来源已携带 `collection_items`，便省略可由它重建的 `column_items`，避免重复发布兄弟条目。

首页、普通页面和 taxonomy 的模型生成器负责不同的路径来源，最终共用一个列渲染器。`navigation/path/model.html` 直接按 Hugo 页面种类调用相应生成器；模型不返回 `variant` 或 `strategy` 标签，也没有额外的字符串分发层。

第一列只渲染一次，来源模型不携带完整根菜单，也不根据“第一列已覆盖”删除路径集合。分类根的子项可作为第二列出现，分类数量由内容决定。

## 布局与维护边界

第一列、路径列和内容列表共用 `list/link-cell.html` / `list/item-content.html`、选中状态与导航列宽。版权、备案等信息使用普通根入口，已无独立页脚。
`slots.breadcrumb` 仅控制路径栏是否显示；它不控制全站入口初始化，也不存放进入路径状态。

各宽度采用同一横向列结构：每个尾部路径项目是一列普通列表，直接展示兄弟项目；没有兄弟列表时仍显示该项目的一行链接。SSR 与客户端重绘使用相同的列头、图标与选中规则，不再存在下拉菜单触发器、隐藏面板或宽度模式。

文档负责整页横向滚动；入口和路径列固定为 `15rem`，正文取视口可用宽度与 `88ch` 的较小值。表格与代码在正文内局部滚动。DOM 顺序与视觉顺序一致。

`canvas-position.js` 不再主动把新页面的主列移入视野。沿列表在同标签页打开页面时，只向下一文档传递来源、目标与横向视觉坐标；目标页读取后清除记录，来源与目标匹配的新访问才使用，已有列保持位置，新列向右扩展。内联入口位于头部样式之后，在解析到 `#main` 时通过临时 `scroll-margin` 和一次原生 `scrollIntoView` 还原坐标，随后清除临时样式。浏览器自行处理桌面文档滚动与手机视觉视口平移，不另建滚动容器或设备模式。主列宽度与前置骨架须提前确定；已有滚动位置、锚点或加载期间的输入优先。直接访问从画幅起点开始，历史返回、前进和刷新使用原生恢复，排序与异步重绘不重置画幅。

修改路径排序协议参见 [navigation-state.md](navigation-state.md)。列表与产品声明见 [collection-lists.md](collection-lists.md)。主题配色由外观选择页与黑白色变量控制；历史实施过程见 [入口展平记录](navigation-flattening-plan.md)。
