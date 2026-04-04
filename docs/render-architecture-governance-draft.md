# Hugo 渲染架构与治理草案

面向目标：

- 降低长期维护心智
- 让 content bundle 只承担内容职责
- 让渲染框架成为稳定、低数量、可治理的系统能力
- 尽量站在 Hugo 原生能力之上，而不是再造一套与 Hugo 平行的模板分发协议

## 一句话决策

推荐采用：

- `layout` 作为 bundle 的唯一渲染框架选择字段
- `baseof.html` 作为全站壳层
- 渲染框架负责面包屑、响应式布局、样式注入、交互骨架、SEO 插槽、组件装配
- bundle 只负责：
  - 指定 `layout`
  - 提供正文内容
  - 提供图片、下载、图标、媒体等 page resources
  - 提供业务元数据

不推荐继续让 bundle 分别声明：

- `render_main`
- `render_breadcrumb`
- `render_styles_variant`
- `render_workspace`
- `render_mode`

因为这会把“一个页面属于哪个框架”拆成多个开关，长期一定会提高理解和排障成本。

## 核心判断

### 1. Hugo 并不要求你维护一整套“默认页面框架”

Hugo 真正要求的是：

- 对于当前启用的页面种类和输出格式，最终必须能找到一个匹配模板
- `baseof.html` 不能独立充当入口；它只有在被命中的模板包含至少一个 `define`，且文件中没有其他非注释/非空白内容时，才会被套用

这意味着：

- `home.html`、`page.html`、`section.html`、`taxonomy.html`、`term.html`、`single.html`、`list.html`、`all.html` 并不是都必须同时存在
- 你完全可以把 HTML 主渲染面收缩到非常少的入口模板
- 但不能只留一个 `baseof.html`，其余全删空

### 2. 对“低心智架构”最友好的原生入口不是自造 `render`，而是 Hugo 的 `layout`

如果 bundle 只允许声明一个框架字段，那么最自然的选择就是 Hugo 原生 front matter 的 `layout`：

- 这是 Hugo 官方支持的模板定向机制
- 它在模板查找权重中优先级很高
- 它比自造 `render` 字段少一层转译
- 维护者阅读 front matter 时，不需要同时理解“你们自己的渲染协议”和 Hugo 查找规则两套东西

结论：

- “唯一渲染框架字段”应当是 `layout`
- 不建议再平行定义 `render = xxx`，除非必须兼容旧系统

### 3. Hugo 适合中大型静态站点，但不会替你定义完整企业架构

Hugo 的能力边界很清晰：

- 它非常适合中大型静态项目，包括多语言、文档站、企业站、活动站、产品站、内容站
- 它提供强大的组织原语：templates、modules、mounts、cascade、segments、output formats、page resources、render hooks、shortcodes
- 但它不会像全栈应用框架那样，替你定义一套完整的业务分层与目录治理

所以大型 Hugo 项目的正确姿势不是“完全依赖官方默认目录”，而是：

- 站在 Hugo 原语之上，自定义一套团队级的约束
- 同时尽量不要与 Hugo 原生机制对着干

## 推荐架构

## 一、职责边界

### A. Content bundle 的职责

bundle 只负责：

- 选择渲染框架：`layout`
- 提供正文内容：Markdown / HTML
- 提供页面本地资源：图片、icon、下载文件、媒体资源
- 提供业务语义元数据：标题、描述、标签、导航权重、SEO 内容字段等

bundle 不负责：

- 面包屑策略
- 响应式布局策略
- 主体布局结构
- 全局或框架级 CSS/JS 选择
- workspace 模式、list 模式、grid 模式之类框架内部决策

### B. 渲染框架的职责

渲染框架负责：

- 页面骨架
- 头部与尾部插槽
- 面包屑
- 主内容容器结构
- 响应式布局
- 样式与脚本装配
- 组件装配
- 框架级辅助数据输出

渲染框架是“页面产品线”，不是“路径映射”。

例如：

- `layout: home-brand`
- `layout: article`
- `layout: landing`
- `layout: catalog`
- `layout: docs`
- `layout: profile`

推荐把这类框架数量控制在低位，保持“少而稳”。

## 二、推荐目录结构

以下结构强调“框架家族”和“共享能力”，而不是去镜像 `content/` 路径：

```text
content/
  _index.md
  products/
    _index.md
    foo/
      index.md
      hero.png
  docs/
    _index.md
    getting-started/
      index.md
      diagram.svg
  campaigns/
    spring-2027/
      index.md
      cover.jpg

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
  rss.xml
  sitemap.xml

  article.html
  home-brand.html
  landing.html
  catalog.html
  docs.html
  profile.html

  _partials/
    shell/
      head.html
      header.html
      footer.html
      breadcrumb.html
    layout/
      article/
        main.html
        head-extra.html
      home-brand/
        main.html
        head-extra.html
      landing/
        main.html
      catalog/
        main.html
      docs/
        main.html
        sidebar.html
      profile/
        main.html
    components/
      card.html
      prose.html
      hero.html
      toc.html
    seo/
      meta.html
      schema.html
    nav/
      primary.html
      secondary.html
  _markup/
    render-link.html
    render-image.html
    render-heading.html
  _shortcodes/
    fragment.html
    callout.html
    gallery.html

assets/
  css/
    core/
    shell/
    components/
    layout/
      article/
      home-brand/
      landing/
      catalog/
      docs/
      profile/
  js/
    core/
    shell/
    components/
    layout/
      article/
      home-brand/
      landing/
      catalog/
      docs/
      profile/

data/
  site/
  nav/
  integrations/
```

## 三、入口模板策略

### 推荐策略：框架模板为主，kind 模板为兜底

推荐保留两层，但让第二层极薄：

第一层：

- `layout: article` 直接命中 `layouts/article.html`
- `layout: landing` 直接命中 `layouts/landing.html`
- `layout: docs` 直接命中 `layouts/docs.html`

第二层：

- `home.html`
- `page.html`
- `section.html`
- `taxonomy.html`
- `term.html`
- `all.html`

这层只负责兜底，不承载业务复杂度。

### 为什么还保留兜底模板

原因不是业务，而是运行安全：

- 首页、taxonomy、term、section 页并不总会显式写 `layout`
- 后续有人忘记声明 `layout` 时，系统仍应有一个一致、可读、可定位的退路
- 对非 bundle 页面、自动生成页、特殊输出页，依然需要明确 fallback

因此推荐：

- 把业务逻辑放进框架模板
- 把 kind 模板保留为极薄的兜底层
- 不把 kind 模板理解成“业务框架”

### `all.html` 的角色

`all.html` 适合用作：

- 最终通用兜底
- 调试期统一出口
- 新架构迁移期的保险丝

但不建议长期把所有复杂分发都塞进 `all.html`，否则会变成一个新的“大总管模板”。

## 四、front matter 治理建议

### 推荐保留的页面级字段

```yaml
layout: article
title: ...
description: ...
slug: ...
weight: ...
menu: ...
params:
  hero_title: ...
```

### 推荐减少或禁用的页面级字段

以下字段若用于控制布局实现，应视为不推荐：

- `render_main`
- `render_breadcrumb`
- `render_styles_variant`
- `render_workspace`
- `render_mode`
- 任何 `params.xxx` 中实际上承担布局路由职责的字段

### `type` 的治理

推荐：

- `type` 用于内容语义，或完全不显式设置
- 不把 `type` 当作页面框架选择器

原因：

- `type` 会进入 Hugo 查找权重
- 一旦把 `type` 和 `layout` 混用，排障成本会明显上升
- 对低心智架构而言，渲染入口最好只有一个主旋钮

因此：

- “页面属于哪个框架”看 `layout`
- “页面在内容上属于哪一类”才看 `type`

## 五、CSS / JS 治理

### 原则

页面框架拥有样式与脚本装配权。

这意味着：

- 全局样式放 `assets/css/core/` 与 `assets/css/shell/`
- 框架样式放 `assets/css/layout/<layout>/`
- 通用组件样式放 `assets/css/components/`
- 页面不通过 front matter 逐项拼装框架级样式

### 对 bundle 自定义 CSS / JS 的建议

最稳妥的治理方式是：

- 默认不使用 bundle 自定义 CSS / JS
- 将 `page_primary_inline_css / page_css / page_js` 降级为“例外逃生口”

允许的场景：

- 营销落地页短期实验
- 离线页、活动页、嵌入页等强 one-off 页面
- 某些确实不值得上升到通用框架层的特殊交互

不允许的场景：

- 拿 bundle CSS/JS 替代框架层
- 用 bundle CSS/JS 修修补补框架本应负责的布局行为

建议规则：

- 新页面先不用 `page_*`
- 只有在“无法合理归入框架层或组件层”时才开例外
- 一旦三页以上复用，就必须提升到框架/组件资产

## 六、section 级默认值：用 cascade，不要复制粘贴

大型 Hugo 项目里，降低心智的关键不是给每个 bundle 多写字段，而是把默认值向上收。

推荐：

- 在 section `_index.md` 中用 `cascade` 下发 `layout`
- 在子页面需要偏离时，才显式覆盖

例如：

```yaml
cascade:
  layout: article
```

这样：

- `content/docs/` 整个子树可统一用 `layout: docs`
- `content/products/` 整个子树可统一用 `layout: catalog`
- 少数特殊页再显式改为 `layout: landing`

这比在每页上声明一组 `render_*` 更低心智。

## 七、适合大型项目的 Hugo 组织方式

Hugo 对中大型项目最有价值的能力，不是“单仓单站博客模板”，而是下面几项：

### 1. Modules

适合把系统拆成：

- 站点壳模块
- 品牌/设计系统模块
- 文档模块
- 产品内容模块
- 数据模块

推荐的中大型形态：

- 主站 repo 负责最终组装
- 框架与通用能力拆为 module
- 内容可来自多个 module 或挂载目录

### 2. Mounts

适合：

- 组合多个内容源
- 重组目录映射
- 把非标准目录挂载到 Hugo 标准目录树

这对大型团队非常重要，因为它允许：

- 代码仓库结构服务于团队协作
- Hugo 输入结构通过 mount 再映射成标准形态

### 3. Segments

适合：

- 大站点局部构建
- 多语言分段构建
- 高频区域和低频区域分开构建

这是大型 Hugo 站点的重要构建治理能力，不是博客级特性。

## 八、推荐治理规则

建议把以下规则写入团队约定：

### 规则 1

页面框架选择只允许一个主入口：`layout`

### 规则 2

任何页面不得再通过多个 front matter 字段拼装布局行为

### 规则 3

新增框架必须是“低数量、可复用、语义稳定”的家族，不得为了单页效果随意新增 layout

### 规则 4

新增 layout 时，必须同步定义：

- 它适用的页面类型
- 它拥有的 CSS/JS 资产
- 它的可扩展插槽
- 它与其他 layout 的边界

### 规则 5

bundle 自定义 CSS / JS 为例外能力，不是常规扩展手段

### 规则 6

一切默认值优先使用 `cascade` 下发，而不是逐页复制

### 规则 7

`type` 不参与页面框架治理；如无必要，不显式设置

### 规则 8

框架目录按“能力/家族”组织，而不是按 `content/` 路径镜像

## 九、建议避免的反模式

### 反模式 A

一个页面同时声明多个 render 开关，再由模板拼接出最终行为。

后果：

- 页面配置面爆炸
- 新人难以判断“真正入口”在哪
- 框架能力边界会越来越模糊

### 反模式 B

为了追求灵活，把 breadcrumb、layout variant、workspace mode、list mode 都下放给 content。

后果：

- 页面作者开始承担框架设计职责
- 内容层与展示层边界被破坏

### 反模式 C

把 `all.html` 做成超级总控器。

后果：

- 一切都能做，但没有边界
- 最终形成新的模板巨石

### 反模式 D

按 `content/` 路径全量镜像 `assets/css`、`assets/js`、`layouts`。

后果：

- 共享能力碎片化
- 复用性下降
- 真正的框架家族被路径私有化

## 十、最终推荐的落地版本

如果以“低维护心智”作为最高优先级，推荐采用下面这套最终版本：

### 页面合同

bundle 只关心：

- `layout`
- 内容
- 资源
- 业务元数据

### 模板合同

框架关心：

- 壳层
- 组件
- 样式
- 脚本
- 面包屑
- 响应式
- 页面骨架

### 目录合同

- `content/` 按信息架构与 URL 组织
- `layouts/` 按框架家族与 Hugo 模板种类组织
- `assets/` 按共享能力与框架家族组织
- 大规模拆分时使用 Modules 和 Mounts

## 十一、实施顺序建议

推荐按以下顺序推进：

1. 先确立治理规则：以后只允许 `layout` 作为唯一框架选择字段
2. 再收缩 bundle front matter：逐步淘汰 `render_*`
3. 再整理模板目录：把业务逻辑从 kind 模板移出，收敛到 layout 家族
4. 再收敛 CSS/JS：把框架级资产上收到 `assets/layout/` 和 `assets/components/`
5. 最后再考虑 modules / mounts / segments 等大型治理能力

## 参考

- Hugo Template types: <https://gohugo.io/templates/types/>
- Hugo Template lookup order: <https://gohugo.io/templates/lookup-order/>
- Hugo New template system in v0.146.0: <https://gohugo.io/templates/new-templatesystem-overview/>
- Hugo Page.Layout: <https://gohugo.io/methods/page/layout/>
- Hugo Configure cascade: <https://gohugo.io/configuration/cascade/>
- Hugo Modules introduction: <https://gohugo.io/hugo-modules/introduction/>
- Hugo Configure modules: <https://gohugo.io/configuration/module/>
- Hugo Configure segments: <https://gohugo.io/configuration/segments/>
- Hugo Introduction: <https://gohugo.io/about/introduction/>
- Hugo Features: <https://gohugo.io/about/features/>
- Docsy: <https://www.docsy.dev/>
- Kubernetes on Docsy: <https://kubernetes.io/blog/2020/06/better-docs-ux-with-docsy/>
- GitLab Handbook architecture: <https://handbook.gitlab.com/docs/development/architecture/>
- GitLab docs site architecture: <https://docs.gitlab.com/development/documentation/site_architecture/>
