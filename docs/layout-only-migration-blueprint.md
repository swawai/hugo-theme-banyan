# `layout` 唯一入口迁移蓝图

本文是 [Hugo 渲染架构与治理草案](./render-architecture-governance-draft.md) 的执行版补充。

目标不是继续讨论理念，而是把“bundle 只声明一个渲染框架入口”落成一套可实施、可回滚、可验收的迁移方案。

## 目标

将当前页面渲染合同收敛为：

- bundle 只声明一个页面框架入口：`layout`
- `baseof.html` 负责全站壳层
- 框架模板负责：
  - 面包屑
  - 响应式布局
  - 样式装配
  - 交互装配
  - 页面骨架
- `render_*` 退场

## 范围

本文聚焦：

- HTML 主站点页面
- bundle front matter
- 主题模板组织方式
- 兼容期与验收标准

本文不直接重构：

- taxonomy/term 的内容模型
- service worker 策略
- prefetch 策略
- 多输出格式的业务含义

这些能力保留，但要从“页面配置开关”收回到“框架内部实现”。

## 现状快照

以下统计基于当前仓库内容分布：

### `render_main`

- `article`: 15
- `home-brand`: 3
- `products-list`: 3

### `render_breadcrumb`

- `article-path`: 6
- `home-sections`: 9

### `render_styles_variant`

- `home`: 3
- `page-crumb`: 15
- `products`: 3

### `render_workspace`

- `dir`: 12
- `none`: 6
- `products`: 3

### 已使用原生 `layout`

- `layout=offline`: 3
- `layout=prefetch-debug`: 1

### 当前可见结论

- 真正活跃的内容框架组合并不多
- 当前系统已经天然适合收敛为少量 `layout` 家族
- 复杂度更多来自“组合开关”而不是“框架数量”

## 目标模型

## 一、页面框架家族

推荐收敛为以下少量 layout 家族：

### 1. `home-brand`

用途：

- 首页品牌页
- 首页叙事入口页

负责：

- 首页骨架
- 首页导航与品牌露出
- 首页专属首屏与布局策略
- 首页样式装配

### 2. `article`

用途：

- 标准正文页
- 叙事页
- 独立文章页
- 说明页

负责：

- 标准正文骨架
- 根据页面位置或业务语义自动决定 breadcrumb
- 根据页面位置决定是否启用某些框架能力

这个框架内部可以继续区分：

- home narrative article
- standalone article

但这些区分不再由 bundle 通过多个字段声明，而由框架内部推断。

### 3. `catalog`

用途：

- 产品总览
- 目录页
- 以列表、卡片、筛选为核心的业务入口页

负责：

- 列表视图
- grid/list 响应式策略
- 排序/筛选交互装配
- 产品类框架样式与脚本

当前 `products-list` 建议迁移为 `catalog`，因为 `catalog` 更像稳定框架家族名，而不是某一种具体视图实现。

### 4. `profile`

用途：

- Me / Profile / About-me 类页面

负责：

- 轻量个人介绍页骨架
- 页面专属交互

当前 `type=me` 的页面建议迁移到 `layout=profile`。

### 5. `offline`

用途：

- 离线提示页

说明：

- 这是特例 layout
- 可以继续保留为单用途页面框架

### 6. `prefetch-debug`

用途：

- 调试与实验页

说明：

- 这是特例 layout
- 不应参与常规页面架构设计

## 二、哪些页面不走 bundle 声明框架

以下页面不需要 bundle 显式声明 `layout`，可继续由 Hugo 模板种类或专用模板负责：

- taxonomy
- term
- 404
- RSS
- sitemap
- robots.txt
- 纯输出格式模板

原则：

- “bundle 页面”讲 `layout`
- “系统页/生成页/特殊输出页”讲 Hugo 原生模板种类

这能把 bundle 作者的心智面尽量收窄到真正可编辑页面上。

## 三、字段治理

### 允许保留

推荐保留：

```yaml
layout: article
title: ...
description: ...
slug: ...
weight: ...
linkTitle: ...
nav_id: ...
nav_parent_id: ...
nav_weight: ...
page_primary_inline_css:
page_css:
page_js:
```

### 逐步废弃

以下字段进入废弃流程：

- `render_main`
- `render_breadcrumb`
- `render_styles_variant`
- `render_workspace`
- `render_mode`

### `page_*` 的治理定位

保留：

- `page_inline_css`
- `page_primary_inline_css`
- `page_css`
- `page_js`

但定位从“常规页面搭建能力”改为“例外能力”。

规则：

- 框架级功能优先进入 layout 资产
- bundle 级 CSS/JS 只用于真正 one-off 页面
- 一旦出现跨页复用，应提升到框架或组件层

### `type` 的治理定位

推荐：

- `type` 只承载语义或兼容旧 Hugo 查找
- 不再承担框架路由职责

目标状态：

- 能不用 `type` 显式设置就不用
- 页面属于哪个框架，只看 `layout`

## 四、目标目录结构

推荐按 Hugo 新模板系统思路收敛：

```text
themes/banyan/
  layouts/
    baseof.html
    all.html
    home.html
    page.html
    section.html
    taxonomy.html
    term.html
    404.html
    robots.txt
    sitemap.xml

    home-brand.html
    article.html
    catalog.html
    profile.html
    offline.html
    prefetch-debug.html

    _partials/
      shell/
      layout/
        home-brand/
        article/
        catalog/
        profile/
      components/
      seo/
      nav/
    _shortcodes/
    _markup/
```

说明：

- 最终应尽量从 `layouts/_default/` 迁到 `layouts/` 根层
- `layouts/partials/` 应迁到 `layouts/_partials/`
- `layouts/shortcodes/` 应迁到 `layouts/_shortcodes/`

这是 Hugo 0.146+ 新模板系统推荐方向。

## 迁移策略

## Phase 0：冻结新债务

先立规则：

- 新增页面不得再引入新的 `render_*`
- 新增页面必须优先使用 `layout`
- 新增框架需求必须先判断能否复用现有 layout 家族

验收标准：

- 团队约定已成文
- 新增内容的 front matter 示例已改成 `layout`

## Phase 1：建立兼容桥

这一阶段不删旧逻辑，只建立“新优先、旧兼容”的桥接层。

兼容规则：

- 若页面显式声明 `layout`，则 `layout` 胜出
- 若未声明 `layout`，则由旧 `render_*` 组合映射出一个临时 layout
- 若同时声明 `layout` 和 `render_*`，编译期警告或失败，避免双源真相

推荐映射：

### 映射 A

```yaml
render_main: "home-brand"
```

迁移为：

```yaml
layout: "home-brand"
```

### 映射 B

```yaml
render_main: "article"
```

迁移为：

```yaml
layout: "article"
```

说明：

- `home-sections` 与 `article-path` 不再作为页面声明
- 由 `article` 框架内部推断 breadcrumb 策略

### 映射 C

```yaml
render_main: "products-list"
```

迁移为：

```yaml
layout: "catalog"
```

### 映射 D

```yaml
type: "me"
```

迁移为：

```yaml
layout: "profile"
```

### 保持不变

```yaml
layout: "offline"
layout: "prefetch-debug"
```

验收标准：

- 系统支持 `layout` 优先
- 旧页面不改内容也能继续输出
- 兼容映射表成文

## Phase 2：创建正式 layout 家族模板

创建：

- `layouts/home-brand.html`
- `layouts/article.html`
- `layouts/catalog.html`
- `layouts/profile.html`
- `layouts/offline.html`
- `layouts/prefetch-debug.html`

每个 layout 只关心自己的页面框架职责，不再依赖 bundle 传多个 `render_*` 开关。

推荐组织方式：

- layout 模板只做装配
- 具体实现下沉到 `_partials/layout/<layout>/...`

示例：

```text
layouts/
  article.html
  _partials/
    layout/
      article/
        main.html
        breadcrumb.html
        head-extra.html
```

验收标准：

- 每个主要框架都有明确入口模板
- 框架内的 breadcrumb / styles / shell 决策不再依赖 `render_*`

## Phase 3：内容 front matter 回填

为所有 bundle 页面显式补齐 `layout`：

- 首页补 `layout: home-brand`
- 标准正文页补 `layout: article`
- 产品入口页补 `layout: catalog`
- Me 页补 `layout: profile`

同时删除对应 `render_*`。

推荐顺序：

1. 首页
2. 标准正文页
3. 产品入口页
4. 特例页面

验收标准：

- 所有 bundle 页面都能直接靠 `layout` 渲染
- `render_*` 仅剩极少数兼容残留

## Phase 4：清除旧渲染合同

删除或下线：

- `page-render-contract` 的旧组合逻辑
- `render-main` / `render-breadcrumb` 这种“再分发入口”作为主路径的职责
- 依赖 `render_styles_variant`、`render_workspace`、`render_mode` 的页面级布局路由

保留的只有：

- Hugo 原生 kind 模板作为兜底
- layout 家族作为主入口
- partials 作为实现层

验收标准：

- `render_*` 不再出现在内容中
- 旧 contract 不再是主路径
- 内容作者只需要理解 `layout`

## Phase 5：模板目录现代化

根据 Hugo 0.146+ 新模板系统，逐步迁移：

- `layouts/_default/*` -> `layouts/`
- `layouts/partials/*` -> `layouts/_partials/*`
- `layouts/shortcodes/*` -> `layouts/_shortcodes/*`

这一步不是必须先做，但推荐在旧 contract 下线后做。

原因：

- 避免边迁架构边迁目录，降低变量叠加
- 待 layout-only 主线稳定后再做目录现代化，更稳

验收标准：

- 模板目录与 Hugo 新模板系统一致
- 新人不需要再理解旧目录兼容层

## 框架内推断规则建议

既然 bundle 不再负责 breadcrumb / styles / workspace 等声明，那么这些行为要明确收回到框架内部。

## 一、`article` 的 breadcrumb 推断

建议：

- 默认使用路径型 breadcrumb
- 若页面属于首页叙事分支，则使用 home-sections breadcrumb

推断来源应优先使用：

- 内容位置
- 导航关系字段
- section 语义

不建议再为此引入新的页面级布局字段。

## 二、`article` 的响应式与 workspace 推断

建议：

- 由输出格式、section 语义、页面种类决定
- 不再让 bundle 显式声明 `workspace`

如果某类页面长期需要另一套结构，应新增或拆分 layout 家族，而不是继续给 `article` 加更多页面开关。

## 三、`catalog` 的排序与列表行为

建议：

- 排序模式由 `catalog` 内部默认决定
- 若需业务排序规则，应使用业务字段或 URL query，而不是 front matter 里的布局字段

例如：

- `?sort=name`
- `?sort=date`

而不是继续保留 `render_mode`。

## kind 模板治理

推荐最终保留：

- `home.html`
- `page.html`
- `section.html`
- `taxonomy.html`
- `term.html`
- `all.html`

但角色改为：

- 兜底模板
- 系统页模板
- 迁移期保险丝

不再让这些模板承载主要业务路由逻辑。

原则：

- 业务路由看 `layout`
- 系统兜底看 kind

## 例外治理

以下情况允许保留例外：

- 调试页面
- 离线页面
- 极少数实验型或一次性营销页
- 某些必须独占框架的系统功能页

但例外页面也应显式使用 `layout`，而不是重新引入多字段 render 协议。

## 推荐的最终 front matter 示例

### 首页

```yaml
layout: home-brand
title: Home
nav_id: home
nav_slot: primary
nav_weight: 1
page_primary_inline_css:
  - page.css
```

### 标准正文页

```yaml
layout: article
title: Method
slug: method
nav_parent_id: home
nav_weight: 3
```

### 产品入口页

```yaml
layout: catalog
title: Products
nav_id: products
nav_slot: primary
nav_weight: 2
page_css:
  - page.css
```

### Me 页

```yaml
layout: profile
title: Me
page_css:
  - page.css
page_js:
  - page.js
```

## 风险与控制

### 风险 1

`article` 变成新的“万能框架”。

控制：

- 一旦 `article` 内出现大量互斥逻辑，立即考虑拆出新的 layout 家族

### 风险 2

`all.html` 变成新的总控器。

控制：

- `all.html` 只做兜底，不做复杂业务分发

### 风险 3

bundle 自定义 CSS / JS 重新膨胀成主路径。

控制：

- 建立“one-off 才允许”的规则
- 超过三页复用即上收

### 风险 4

`type` 与 `layout` 混用造成新的双源真相。

控制：

- 编译期校验
- 文档与示例只教 `layout`

## 迁移完成的判定标准

满足以下条件，即视为 layout-only 架构落地完成：

1. 所有 bundle 页面使用 `layout` 作为唯一框架入口
2. `render_*` 从内容 front matter 中清零
3. `page-render-contract` 不再承担主路径职责
4. kind 模板只做兜底，不做主要业务分发
5. 面包屑、响应式、样式装配等逻辑全部回收至框架模板
6. 新页面作者能在不理解旧 render 协议的前提下独立建页

## 最后一条建议

迁移时不要同时追求三件事：

- 改页面合同
- 改模板目录
- 改设计系统结构

推荐顺序始终是：

1. 先统一页面合同为 `layout`
2. 再收拢框架实现
3. 最后再做目录现代化与资产再分层

这样能把迁移风险压到最低。
