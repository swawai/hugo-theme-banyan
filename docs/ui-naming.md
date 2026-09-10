# UI 命名与职责

名称按当前职责组织，不再描述已经退役的主菜单、顶部面包屑和下拉布局。

| 实体 | 名称与位置 |
| --- | --- |
| 第一列根入口 | `browse/root-navigation.js`、`feature-browse/navigation/root/render.html`；由真实页面的 `root_nav` 声明产生 |
| 可见路径列 | `browse/path-render.js`、`path-navigation.css`；容器 `.path-columns`、单列 `.path-column` |
| 集合页面 | `layouts/page-collection.html`、`feature-browse/collection/render-page.html`；列表内容由 `feature-browse/collection/render.html` 渲染 |
| 集合条目 | `collection-item.css` 负责条目和状态，`collection-grid.css` 负责 `.collection-list` 公共网格，`collection-table.css` 负责 `--directory`／`--all`／`--products` 列定义 |
| 文档元信息 | `document-meta.css`；负责 `.document-meta` 内的日期与分类信息，不属于正文组件 |
| 正文中的有序／无序列表 | `prose-lists.css`；只作用于正文 `ul/ol/li` |
| 区域开关 | `slot_flags`、`slotFlags`；值是布尔值，不再是 fragment 来源 |
| 浏览来源与排序状态 | `browse/navigation-state.js`、`browse/navigation-state.contract.js` |
| 语言和外观偏好 | `preferences/language-page.js` 仅用于选择页；`preferences/language-return.js` 与 `preferences/theme.js` 负责跨页面行为；静态选项和返回链接在模板输出 |
| 检查与应用更新 | `updates/page.js` 连接页面、更新引擎与状态呈现；模板为 `feature-updates/panel.html`、`feature-updates/labels.html` |

## 内容声明

集合页统一声明 `layout: page-collection`。例如更新目录只显示名称：

```yaml
layout: page-collection
list: name
```

`layout` 选择页面模板，`list` 选择列表展示；集合成员来自 Hugo 的目录／分类结构，或 `aggregate` 指向的集合。更名没有改变这三个职责，也没有提供 `article-list` 旧模板别名。根项目与主题自身内容已经迁移；`exampleSite` 按项目约定留待单独处理。

## 路径数据与显示

服务端的 `feature-browse/navigation/path/` 与浏览器端的 `browse/path-entry.js`、`browse/path-render.js`、`browse/breadcrumb-*.js` 共同处理结构路径、浏览来源及恢复。`system-metadata/seo/breadcrumb.html` 输出 SEO 的 BreadcrumbList；`slots.breadcrumb` 和网址 `from / sort / sorts` 保持既有约定。

可见路径列通过 `renderPathColumns()` 装配，通过 `renderPathColumn()` 重绘单列。条目模块从页面边界已解码的 payload 生成行数据。路径模型中 `column_items` 表示该列的兄弟条目，行的选中状态只使用 `current`；不再读取 `highlighted`、`selected` 别名。输入参数 `selected_href` 等仍明确表示用哪个地址寻找当前行。

首页、普通页面、分类法分别使用 `model-home`、`model-page`、`model-taxonomy` 生成结构路径；`model.html` 保留按页面类型选择模型的显式分支，不再使用没有对应手动模式的 `-auto` 后缀。

`page-shell.css` 中，`--main-column-inline` 控制主内容与元信息宽度，`--navigation-column-inline` 统一控制第一列、路径列与列表名称列的宽度，`--page-shell-gap-inline` 统一控制画幅列间距。各屏幕宽度使用同一套画幅；不再给相同尺寸建立 rail／path 转发变量。

## CSS 源码与发布名

`assets/css/` 保持扁平。19 个源码按前缀排列：`theme.css` 提供主题变量；`base.css` 与 `icons.css` 提供页面基础和图标；`page-shell.css` 与 `path-navigation.css` 提供画幅；三个 `collection-*` 文件提供列表；`document-meta.css` 提供元信息；`prose-base.css`、`prose-inline.css`、`prose-lists.css`、`prose-quotes.css`、`prose-images.css`、`prose-code.css`、`prose-tables.css` 提供正文；`home-brand.css`、`updates-panel.css`、`not-found.css` 属于具体入口。

源码文件表达维护职责，发布文件表达缓存边界。`baseof.html` 直接装配公共 `page.css`；七个 `prose-*` 源码只在页面确实输出 `.prose` 时合并成一个 `prose.css`；`updates-panel.css` 与 `not-found.css` 虽保留独立源码归属，也进入 `page.css`。首页另发 `home-brand.css` 和三种语言各自的场景样式，因此完整生产构建共有 6 个 CSS 资源。

## 更新模块

`feature-updates/labels.html` 返回检查更新页提供的文案，`feature-updates/panel.html` 负责 HTML，`assets/css/updates-panel.css` 负责呈现，`assets/js/updates/page.js` 负责读取本页静态文案并绑定状态与操作。该小型 CSS 源码仍由公共 `page.css` 装配；页面脚本只由 `page-update-check.html` 加载。页面通过已有 `window.BanyanServiceWorkerManagerRuntime.updates` 的 `subscribe(listener)` 接收 `{status, latencyMs}`，通过 `check()` 检查或应用更新。引擎不导入页面 UI、查询控件或加载文案；未启用 SW 时页面显示不可用。`site_update` 文案声明和 `data-site-update-*` 操作接口表示站点更新功能，与旧 `/site/` 页面无关。

## 样式类与行为标记

`.collection-panel` 是一列宽的页面容器；其中的 `.collection-list` 才是列表。每个单元格使用 `.collection-cell`，名称、日期等用 `--name`、`--date` 等修饰；当前选中继续使用 `.is-current`。正文元信息统一为 `.document-meta__row`、`__label`、`__separator`，跳转正文链接为 `.skip-link`。

排序读取 `data-collection-cell` 和 `data-collection-header`，进入条目使用 `data-collection-entry`，排序箭头使用 `data-sort-indicator`。这些标记表达行为，样式类表达呈现；SSR 和动态路径列一起输出它们。删除了旧 `grid-*`、`cell-*`、`path-column-link` 类名，不保留两套选择器。类名和文件名无需逐字一致，`grid` 在文件或局部变量中仍准确描述 CSS Grid 实现。

`base.css` 仅负责元素默认值、焦点、跳转正文和全站过渡。共享不等于基础：图标、画幅和列表仍用自身职责命名，不因进入 `page.css` 而机械增加 `base-` 前缀。

新增名称前先确认职责；不因为位置移动而重命名 Hugo 原生字段、公开网址协议或已有准确名称，也不保留无删除条件的旧名称转接层。
