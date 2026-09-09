# Partial 架构

`layouts/partials` 按职责组织，而不是按页面名称或历史实现组织。目标是让维护者从调用路径就能判断数据从哪里来、在哪一层变形，以及哪一层允许输出 HTML。

## 数据流与允许调用方向

```text
Hugo section ─────────────→ collection rows
Hugo taxonomy → taxonomy ─→ collection rows
collection rows → navigation/path → navigation/source → layouts/baseof
                  navigation/path → seo/breadcrumb → layouts
routing → collection + navigation/path（只提供 URL 状态协议）
```

上图箭头表示事实如何流向消费者，不表示 partial 的调用方向。允许调用方向与它相反且保持单向：布局可调用 `navigation/source`、`navigation/path`、`collection` 和 `seo`；`seo/breadcrumb` 调用 `navigation/path`；`navigation/source` 调用 `navigation/path` 与 `collection`；`navigation/path` 调用 `collection`、`taxonomy` 与 `routing`；`collection` 调用 `taxonomy` 与 `routing`。`taxonomy` 和 `routing` 不反向调用这些消费者。

`collection` 只读取 `routing` 来生成 URL，不据此决定成员；`navigation/source` 不重新实现 section 或 taxonomy 的成员发现；SEO 只消费结构路径，不参与可见导航渲染。

## 目录职责

- `asset/`：Hugo Pipes、页面资源发布与 CSS 构建。`publish-local` 可查页面包和全局 assets；`publish-page` 只查页面包，两者契约不同。
- `build/`：一次构建的版本与时间事实源。
- `cache-policy/`：合并主题默认值与站点覆盖，返回共享路由和 Service Worker 投影；不生成托管平台文件。
- `collection/`：集合声明、成员、统一 row、排序、集合 HTML 与 `_items.json` 协议。taxonomy 提供的页面节点和分类成员事实也在这里转换成显示字段。
- `content/`：通用正文外壳、正文样式与标题契约。文章元信息和 BlogPosting schema 仍归 `article/`。
- `list/`：多个领域共用的单行呈现组件，不拥有集合成员或点击行为。
- `navigation/root/`：固定的第一列入口；隐藏结构根也可参与选中推导。
- `navigation/path/`：当前页面的结构路径与可见列。
- `navigation/source/`：可序列化的浏览来源模型和来源载荷发布。
- `routing/`：`from`、排序 lineage 等跨集合与导航共用的 URL 状态协议。
- `taxonomy/`：Hugo taxonomy 配置、值解析和成员发现。它返回页面节点，或分类的 term、数量与 Lastmod 等原始事实；不格式化列表日期、大小或排序键。`collection` 消费其成员，`navigation/path` 消费其层级与 URL；它不反向依赖二者。
- `seo/`：head 元数据、分享图和 JSON-LD；不输出可见导航。
- `prefetch/runtime/` 与 `prefetch/speculation/`：两套独立传输机制，共存不等于共享实现；跨机制的槽位所有权与冲突检测只归 `prefetch/coordination.html`。
- `pwa/`：规范化 PWA 配置，发布站点图标、`sw.js` 与浏览器端 Service Worker manager；缓存路由事实仍来自 `cache-policy/`。
- `runtime/`：跨页面脚本共用的 Hugo JS 构建参数、内联脚本构建与运行时数据资源。`asset-manifest.html` 负责发布语言运行时文案和最终 manifest，页面骨架只引用返回的资源；实际 CSP hash 仍由生产构建后处理从最终 HTML 计算。
- `updates/`：更新面板、操作与运行时文案。静态页面和浏览器 JSON 都从 `/updates/check` 的 `site_update.labels` 读取同一份作者文案。
- `deployment/`：把共享缓存策略投影为托管平台路由，并生成发布文件。

## 必须保留的边界

相似代码不代表相同契约：

1. 普通 section 与 taxonomy 都能产出 row，但成员发现规则不同。
2. 结构路径用于静态 HTML 和 SEO；进入来源可受 `from` 改变，不能作为 canonical 事实。
3. 服务端来源模型含 Hugo Page；浏览器投影必须可序列化并控制体积。
4. collection source 是小型描述；`_items.json` 是可能很大的行载荷。
5. Markdown 响应式图片与社交分享图具有不同尺寸和继承规则。
6. 根入口列与路径列可以共享行组件，不能共享“如何找到条目”的渲染器。

## 新增与修改规则

- 调用者知道意图时，直接调用具体 partial；不要新增 `mode`/`type` 字符串分发层。
- partial 调用写完整 `.html` 路径，避免依赖 Hugo 的隐式扩展名解析。
- 单行转发只有在它代表稳定契约或 Hugo 必需入口时才保留。迁移完成后不保留旧路径兼容壳。
- 目录最多使用两层职责分组。只有 `navigation`、`collection/items`、`collection/rows`、`collection/sort`、`taxonomy/children`、`seo/share-image` 和 `prefetch` 这类确有子领域的模块才继续分层。`collection/rows.html` 保留为稳定公共入口，`collection/rows/` 只放页面种类适配器。
- 数据 partial 返回模型；可见 HTML partial 以 `render`、`column`、`cell` 等名字明确表达输出。
- 修改成员发现或 row 字段时，同时验证主列表、路径列、`_items.json`、排序和进入来源恢复。

`baseof.html` 是最终装配点。它可以显式组合领域模块，但不应重新实现领域算法；复杂的构建或部署数据准备应先收敛成返回纯数据的 partial，再由 `baseof` 触发发布。
