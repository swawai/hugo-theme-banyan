# Banyan Layout Slots

## 当前约定

Banyan 当前的页面壳层采用“固定语义 slot + CSS 编排”的方式，而不是让页面 bundle 直接声明布局容器名。

也就是说：

- 页面只声明“我提供什么内容”
- 框架决定“这些内容在单列 / 多列下怎么排”

## 支持的 slots

页面 front matter 中的 `slots:` 当前只支持这些键：

- `primary_nav`
  - 站点顶级主导航
  - 值必须是 fragment page 路径，例如 `/fragments/nav-primary-links`
- `utilities`
  - `Me / Language / Theme`
  - 值必须是 fragment page 路径，例如 `/fragments/nav-utilities`
- `breadcrumb_root`
  - 面包屑首字段，也是根域切换入口
  - 值必须是 breadcrumb model fragment 路径，例如 `/fragments/breadcrumb-model-signals`
- `breadcrumb`
  - 当前页面路径尾部
  - 只接受 `true / false`
- `meta`
  - 当前页面元信息
  - 当前内建内容包括：路径摘要、taxonomy、发布日期 / 更新日期
  - 只接受 `true / false`
- `footer`
  - 页脚 fragment
  - 值必须是 fragment page 路径，例如 `/fragments/home-footer-shortcuts`

补充：

- `main` 是框架内建 slot，不通过 front matter 指向 fragment
- 当前不再支持 `show_breadcrumb`、`show_meta`、`breadcrumb_variant`
- 当前不再使用旧的 `context` 命名；原“根域切换”语义统一收口为 `breadcrumb_root`

## 推荐写法

Signals/目录树页面：

```yaml
slots:
  primary_nav: /fragments/nav-primary-links
  utilities: /fragments/nav-utilities
  breadcrumb_root: /fragments/breadcrumb-model-signals
  breadcrumb: true
```

Products 页面：

```yaml
slots:
  primary_nav: /fragments/nav-primary-links
  utilities: /fragments/nav-utilities
  breadcrumb_root: /fragments/breadcrumb-model-products
  breadcrumb: true
```

文章页：

```yaml
slots:
  primary_nav: /fragments/nav-primary-links
  utilities: /fragments/nav-utilities
  breadcrumb_root: /fragments/breadcrumb-model-signals
  breadcrumb: true
  meta: true
```

首页 / About 之类无需路径导航的页面：

```yaml
slots:
  primary_nav: /fragments/nav-primary-links
  utilities: /fragments/nav-utilities
  footer: /fragments/home-footer-shortcuts
```

## Fragment 命名规则

推荐按“语义来源”命名，而不是按“最终摆放位置”命名：

- `nav-primary-links`
- `nav-utilities`
- `breadcrumb-model-signals`
- `breadcrumb-model-products`
- `home-footer-shortcuts`

尤其不要再使用这类布局导向命名：

- `context`
- `rail-footer`
- `stage-breadcrumb`

因为它们会把内容声明和布局编排绑死。

## 单列与多列的关系

同一组 slot 在不同断点下应复用同一份声明。

例如：

- 单列下，`breadcrumb_root + breadcrumb` 组成同一条 breadcrumb row
- 多列下，`breadcrumb_root` 可以升级为独立列，而 `breadcrumb` 仍保留为路径尾部

因此：

- slot 名是语义
- rail / stage / column 是布局
- 不要在 front matter 里声明 `slot.rail-*` 这类布局 slot
