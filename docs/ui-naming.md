# UI 命名与职责

名称按当前职责组织，不再描述已经退役的主菜单、顶部面包屑和下拉布局。

| 实体 | 名称与位置 |
| --- | --- |
| 第一列根入口 | `root-navigation.js`、`feature-browse/navigation/root/render.html`；由真实页面的 `root_nav` 声明产生 |
| 可见路径列 | `path-navigation-ui.js`、`path-navigation.css`；容器 `.path-columns`、单列 `.path-column` |
| 集合页面 | `layouts/page-collection.html`、`feature-browse/collection/render-page.html`；列表内容由 `feature-browse/collection/render.html` 渲染 |
| 正文中的有序／无序列表 | `prose-lists.css`；只作用于正文 `ul/ol/li` |
| 区域开关 | `slot_flags`、`slotFlags`；值是布尔值，不再是 fragment 来源 |
| 浏览来源与排序状态 | `navigation-state.js`、`navigation-state.contract.js` |
| 语言和外观偏好 | JavaScript `assets/js/preferences/`；语言模型与两张偏好页共用的返回操作位于 `feature-preferences/`，外观固定三项由 `layouts/page-appearance.html` 就地装配 |
| 检查与应用更新 | JavaScript `assets/js/updates/ui.js`，模板 `feature-updates/panel.html`、`feature-updates/labels.html` |

## 内容声明

集合页统一声明 `layout: page-collection`。例如更新目录只显示名称：

```yaml
layout: page-collection
list: name
```

`layout` 选择页面模板，`list` 选择列表展示；集合成员来自 Hugo 的目录／分类结构，或 `aggregate` 指向的集合。更名没有改变这三个职责，也没有提供 `article-list` 旧模板别名。根项目与主题自身内容已经迁移；`exampleSite` 按项目约定留待单独处理。

## 路径数据与显示

服务端的 `feature-browse/navigation/path/` 与浏览器端的 `breadcrumb-*.js` 共同处理结构路径、浏览来源及恢复。`system-metadata/seo/breadcrumb.html` 输出 SEO 的 BreadcrumbList；`slots.breadcrumb` 和网址 `from / sort / sorts` 保持既有约定。

可见路径列通过 `renderPathColumns()` 装配，通过 `renderPathColumn()` 重绘单列。`buildPathColumnItems()` 及其同步版本生成行数据。路径模型中 `column_items` 表示该列的兄弟条目，行的选中状态只使用 `current`；不再读取 `highlighted`、`selected` 别名。输入参数 `selected_href` 等仍明确表示用哪个地址寻找当前行。

首页、普通页面、分类法分别使用 `model-home`、`model-page`、`model-taxonomy` 生成结构路径；`model.html` 保留按页面类型选择模型的显式分支，不再使用没有对应手动模式的 `-auto` 后缀。

`--main-column-inline` 控制主内容与元信息宽度，`--path-column-inline` 控制路径列宽度，`--path-columns-gap-inline` 控制列间距。各屏幕宽度使用同一套画幅；这些名称不表示新的布局模式。

## 更新模块

`feature-updates/labels.html` 直接返回检查更新页提供的文案，`feature-updates/panel.html` 负责 HTML，`assets/js/updates/ui.js` 负责状态与操作绑定。`site_update` 文案声明和 `data-site-update-*` 操作接口表示站点更新功能，与旧 `/site/` 页面无关，继续保留。Service Worker 引擎与缓存策略不由 UI 命名决定。

新增名称前先确认职责；不因为位置移动而重命名 Hugo 原生字段、公开网址协议或已有准确名称，也不保留无删除条件的旧名称转接层。
