# Banyan Breadcrumb Model

## 第一列与进入路径

第一列是当前语言站点的真实根页面列表，由 `navigation/root-pages.html` 构建：
`Home.Pages` 与直接属于 Home 的 taxonomy 根页面取并集，再按页面 `weight` 排序。
名称取 `LinkTitle` / `Title`，地址取 `RelPermalink`。`build.list: local` 的系统页面可以参与入口列表，内部不列出的页面不会因此成为入口。

首页通过列表上方的站点名返回，不额外占一个根入口。页面不声明主菜单归属，也没有独立的菜单项目白名单。
新增入口时，创建真实的根页面并设置名称和权重；新增某个入口的子项时，把它放在相应内容目录中。

## 选中规则

`navigation/selected-page.html` 从当前页面及真实内容祖先中找根入口，提供静态 HTML 的默认选中项。
公开 URL 可以与内容路径不同，因此不能根据 URL 前缀猜所属入口。例如 `content/d/products/xvenv/` 发布在 `/p/xvenv/`，直接访问仍选中“目录”；移入 `content/site/` 的关于页保留 `/about/` 地址，同时归属“系统－站点”。

有效的 `from` 指向当前页面已发布的来源集合。预览与运行时根据该来源的 `root_item` 调整第一列选中项，完整入口列表始终保留。
从“标签”进入同一篇文章就选中“标签”，从“产品－全部”进入就选中“产品－全部”。不存在或不属于当前文章的来源不参与选中，继续使用内容祖先。
系统页面选中自己的根入口；`return` 只保留返回阅读现场的地址，不改变系统页归属。首页或没有根入口祖先的内部页不强制选中一项。

## 路径模型

`breadcrumb/canonical-model.html` 根据普通页面、首页或 taxonomy 的真实结构构建模型：

- `root_item`：第一列应选中的根页面。
- `tail_items`：根页面之后的路径项目。
- `levels`：各路径项目及其所属集合。
- `schema_items`：结构化数据中的页面路径。

项目自身的 `href` 与提供兄弟条目的 `collection_href` 含义不同。例如“WSL”项目指向 `/d/wsl/`，其兄弟列表来自 `/d/`。
`entry-source/source-page-model.html` 将这些层级映射到集合 provider 与 `_items.json`。静态分类列表保留页面权重顺序；动态集合采用自己的默认排序。

第一列只渲染一次，来源模型不携带完整根菜单，也不根据“第一列已覆盖”删除路径集合。这样产品分类的四个兄弟项仍可作为第二列出现。

## 布局与维护边界

第一列、路径列和内容列表共用 `grid-title-cell.html` / `collection/item-content.html`、选中状态与导航列宽。页脚跟随入口列表自然排列。
`slots.breadcrumb` 仅控制路径栏是否显示；它不控制全站入口初始化，也不存放进入路径状态。

修改路径排序协议参见 [navigation-state.md](navigation-state.md)。响应式画幅与黑白主题是后续独立步骤，不通过新增菜单配置实现。
