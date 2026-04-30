# Banyan Breadcrumb Models

## 目的

`themes/banyan/content/fragments/breadcrumb-model-*` 现在应被视为 **正式支持的导航配置面**。

它不再只是“模板作者自己知道怎么配”的私有技巧，而是会同时影响：

- mobile / medium 的 inline breadcrumb
- entry 页运行时 breadcrumb 修正
- wide 下的列式 breadcrumb 视图
- root current 归属
- root 已覆盖 tail menu 时的自动裁剪

所以这里的目标不是“尽量灵活”，而是：

- 配置面小而清楚
- 失败尽早暴露
- 新增导航家族时有稳定心智模型

## 一个最小例子

Products：

```yaml
breadcrumb:
  variant: lead-menu
  auto_tail: current
  menu_mode: current-root
  menu_label: 产品分类
  menu_active_href_source: products-family
  menu:
    - page: /products/first-party
    - page: /products/first-party/paid
    - page: /products/first-party/free
    - page: /products/third-party
```

Signals：

```yaml
breadcrumb:
  variant: lead-menu
  auto_tail: full
  menu_mode: current-root
  menu_label: 切换根页面
  menu_active_href_source: signals-family
  menu:
    - page: /d
    - page: /all
  menu_sources:
    - source: taxonomy-roots
```

## 核心判断

这类 fragment 负责的是 **导航语义**，不是页面布局。

也就是说：

- 它决定 root menu 是什么
- 决定 tail 是自动取当前层，还是完整路径
- 决定当前 root 应该高亮哪一项

但它不决定：

- rail / stage / column 最终怎么排
- wide 下列宽是多少
- dropdown 用什么皮肤

这就是为什么同一份 `breadcrumb-model-*` 配置，会同时服务 mobile / medium / wide，而不是每种版式各配一份。

## 支持的字段

### `variant`

当前支持：

- `trail`
- `lead-menu`
- `lead-only`

含义：

- `trail`
  - 普通 breadcrumb trail
- `lead-menu`
  - 第一项承担 root menu
- `lead-only`
  - inline breadcrumb 只显示 lead 项

当前 root fragments 实际主要使用 `lead-menu`。

### `auto_tail`

当前支持：

- `current`
- `full`

含义：

- `current`
  - 只自动挂当前项
- `full`
  - 自动挂完整路径尾部

例子：

- products 更适合 `current`
- signals/tree taxonomy 更适合 `full`

### `menu_mode`

当前支持：

- `current-root`

含义：

- root menu 的当前项不是简单按第一项或当前页面决定
- 而是从 root menu 中选出“最具体匹配”的当前 root

如果设置了 `menu_mode: current-root`，配置必须最终能解析出 root menu。

### `menu_label`

root menu 的语义标签。

它主要服务：

- 按钮的 `aria-label`
- wide / runtime 中的语义文案

建议总是显式填写，不要完全依赖默认回退。

### `menu_active_href_source`

root current 的来源策略。

当前支持：

- `products-family`
- `signals-family`

这不是一个随便填字符串的扩展口。  
如果你要新增新的 family 策略，应把它视为 **主题级新能力**：

1. 新增 `layouts/partials/breadcrumb/menu-active-href-*.html`
2. 补文档
3. 补校验

### `menu`

显式 root menu。

每项支持一个 breadcrumb item spec，推荐最常用的是：

- `page`

也支持：

- `href`
- `text`
- `name`
- `text_key`
- `title`

推荐优先使用 `page`，因为它：

- 更稳
- 能自动带语言站点相对链接
- 更容易在构建期校验

### `menu_sources`

声明式补充 menu item 来源。

当前支持：

- `taxonomy-roots`
- `section-children`

#### `taxonomy-roots`

把当前站点的 taxonomy roots 追加进 menu。

例子：

```yaml
menu_sources:
  - source: taxonomy-roots
```

#### `section-children`

把某个 section 的直接子 section 追加进 menu。

例子：

```yaml
menu_sources:
  - source: section-children
    page: /docs
    include_self: true
```

这同样是一个正式支持面，而不是可任意拼 partial 名的私有后门。  
如果未来要新增新 source，也应同步补代码、文档和校验。

### `lead`

可选的显式 lead item。

它也使用同一个 breadcrumb item spec。

当前项目里 root fragments 暂时没有实际用到 `lead`，但 canonical model 已支持。

## 构建期保证

当前构建已经会在 fragment load 时校验这些点：

- `breadcrumb` 配置块必须存在
- `variant` 必须来自当前支持集合
- `auto_tail` 必须来自当前支持集合
- `menu_mode` 必须来自当前支持集合
- `menu_active_href_source` 必须来自当前支持集合
- `menu_sources[].source` 必须来自当前支持集合
- `lead` / `menu` 里的 `page` 必须能解析到真实页面
- root menu 最终解析出的 href 不能重复
- `menu_mode: current-root` 不能配出一个空 root menu

这类错误属于“越早失败越好”，因为它们一旦混到运行时，表面上通常只是：

- 当前项高亮不对
- wide 多出一列
- dropdown 排序或覆盖关系错位

而不是一眼就能看出的模板错误。

## Wide 下的一个重要规则

如果 root menu 已经完整覆盖了某个 tail menu，wide 下会自动裁掉那一列。

典型例子是 products：

- root menu 已有 `First-party / Paid / Free / Third-party`
- 某个下层 tail menu 如果再次只给出 `Paid / Free`
- wide 会把这一级判定为“root 已覆盖”，不再重复渲染

关键点是：

- 这个判断基于 **menu href 集合是否已被 root 完整覆盖**
- 不是简单按物理路径层级硬扣一层

这样更稳，也更适合后续继续演化内容结构。

## 什么时候该改 fragment，什么时候该改主题

改 fragment 即可：

- 只是换 root menu 的具体项
- 只是换 `auto_tail=current/full`
- 只是切当前已支持的 `menu_active_href_source`

应该改主题：

- 想新增新的 `menu_active_href_source`
- 想新增新的 `menu_sources`
- 想支持新的 `variant`
- 想改变 root 覆盖 tail 的判定规则

一个简单心智模型：

- **内容决定导航家族的“内容”**
- **主题决定导航家族的“语法与能力边界”**

不要为了某个单站点需求，把新的私有语法偷偷塞进 fragment；  
那样看似灵活，长期其实最难养。
