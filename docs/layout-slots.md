# Banyan Layout Slots

## 当前约定

第一列入口由内容树生成，页面无需声明菜单归属。`slots` 只控制路径和元信息是否装配；框架负责布局。正文 `main` 是内建区域，不通过 front matter 指向 fragment。

## 第一列入口

当前语言的入口集合包含首页自身及直接子页 `Home.Pages`，再合并父页面为首页的 taxonomy 根页。名称取 `LinkTitle`／`Title`，网址取 `RelPermalink`，顺序取页面 `weight`。这是一个完整列表，来源变化只更新选中项。

入口可在自己的 front matter 中用 `icon: folder` 声明 SVG，或用 `icon: { text: "©" }` 声明字符图标；省略时使用 `folder`，不存在的图标会让构建失败。当前语言、外观、我的入口分别声明 `language`、`theme`、`my`，站点入口继续使用默认文件夹。

- 不能只取 `Home.Sections`，因为语言、外观、我的和全部文章包含普通页面。
- 不能只取 `Site.Pages`，因为 `build.list: local` 的系统页只列在其父页集合中。
- taxonomy 根需要单独合并，不能假定它们都在 `Home.Pages` 中。
- `build.list: never` 的内部节点不作为入口。内部 fragment 同时设置 `build.render: never`，避免生成独立页面。
- `weight` 只需在入口本身定义，不应 cascade 到所有文章。

当前项目得到首页、目录、阅读目的、标签、全部文章、产品－分类、产品－全部和四个系统入口。十一项来自当前内容结构，不是固定白名单。首页在 `content/_index*.md` 声明自己的 `linkTitle`、`icon` 和 `weight`，使用普通条目组件，正文继续使用 `home-brand`。

`nav_primary`、`slots.primary_nav`、`slots.utilities` 和 `slots.breadcrumb_root` 已移除，对应的主菜单、系统下拉及 breadcrumb model fragment 不再参与装配。新增入口应建立真实根页面或 taxonomy 根，并提供名称与顺序。

分类法的 `banyan_taxonomy.show_in_home`／`home_weight` 仍控制独立的首页快捷列表，不能当成旧菜单字段删除；第一列排序使用页面 `weight`。

## 支持的 slots

页面 front matter 中的 `slots:` 只支持以下键；省略或设置为 `false` 表示不装配该区域。

| 键 | 值 | 用途 |
| --- | --- | --- |
| `breadcrumb` | `true`／`false` | 当前页面的集合路径及各级条目 |
| `meta` | `true`／`false` | 路径摘要、taxonomy、发布日期和更新日期 |

未知 slot 名和错误值类型均应在构建时失败。`slots.footer`、版权页脚片段及其专用模板和样式已移除。旧 `show_breadcrumb`、`show_meta`、`breadcrumb_variant` 和布局导向的 `rail-*`／`stage-*` 声明不属于当前约定。

## 推荐写法

目录、分类法和产品集合页：

```yaml
slots:
  breadcrumb: true
```

文章页可通过其目录的 cascade 继承以下声明，无需再逐篇设置：

```yaml
slots:
  breadcrumb: true
  meta: true
```

语言、外观页面用顶层 `list: choice` 声明选择行，并分别由 `language-page`、`appearance-page` 布局提供选项，由语言、外观脚本处理操作；我的等系统页无需列表声明。它们都无需为了显示第一列设置 `slots`。布局、集合 provider 和产品属性仍是各自独立的配置。

站点目录使用与普通目录相同的 `layout: article-list`、`list: directory`，只列出真实子页。`site-page` 已删除，`baseof.html` 不追加站点操作，根导航也不承担更新标记。`content/site/pwa/index*.md` 是真实的 PWA 状态子页，`pwa-page` 布局明确调用更新面板与系统样式；页面的 `site_update` 只提供功能文案与更新记录引用，不是全站装配开关。语言和外观布局分别明确调用 `system/return.html`。

保留的 fragment 按内容语义命名，例如 `site-meta`；不要用最终容器位置命名。`site-meta` 提供站点品牌与 SEO 元数据，`slots.meta` 则控制当前页面的日期、taxonomy 等元信息，两者职责不同。

首页链接已统一到普通入口。微信、RSS、GitHub、备案等信息通过 `content/site/` 的真实子页访问；SEO 元数据仍由独立的 head 模板输出。

## 与导航状态和布局的边界

`slots` 决定页面装配哪些区域；`from / sort / sorts` 表示当次浏览来源及排序。有效 `from` 决定第一列选中的来源根，没有有效来源时按真实内容祖先确定归属。不能从公开网址前缀推断归属：例如 Xvenv 的正文位于 `d/products/`，直接访问仍选中目录；通过产品分类进入时选中产品－分类。

系统页使用普通链接，不携带 `return`；语言与外观页的返回行为见 `navigation-state.md`。切换语言留在对应语言的设置页，不改变当前系统入口的选中态。首页选中自身；其他页面匹配自身和最近的可列出祖先，但不把首页当成所有页面的默认选中项。没有可列出根祖先的内部页不强行选中入口。

第一列的存在不表示页面具有 collection browser。集合路径仍由 `slots.breadcrumb`、集合来源和 provider 决定；不要新增 `slots.browser_mode`，也不要把来源、排序和列状态写入 front matter。

同一份入口列表和 slot 声明用于各屏幕宽度。第五步的整页横向画幅保持原有浏览位置；黑白灰配色仍属于尚未开始的第六步。
