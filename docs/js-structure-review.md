# JavaScript 结构与运行边界

检查与实施日期：2026-09-10。适用分支：`codex/flatten-navigation`。

## 结论

J1～J4 已把浏览器代码收敛为一条主路径：Hugo 负责生成当前页面所需的事实，浏览器模块在页面边界解码一次，再按功能域执行。运行时不再请求 manifest、语言 JSON 或路径列 fragment，也没有保留新旧两套初始化流程。

整理的重点不是减少目录数量，而是让维护者能直接回答三个问题：

1. 这段代码属于哪个功能域？
2. 它在首帧、普通页面生命周期、专用页面还是 Service Worker 中执行？
3. 同一项策略的事实源在哪里？

## 目录结构

```text
assets/js/
├─ main.js                  全站普通生命周期入口
├─ browse/                  根入口、路径列、集合排序、URL 状态和画幅
├─ preferences/             语言、外观和返回操作
├─ pages/                   首页、404、离线页的专用入口
├─ updates/                 检查更新页面
├─ prefetch/                预取策略、浏览器输入、运行入口和诊断页
├─ pwa/                     Worker、页面端 manager、更新引擎和缓存命名
└─ inline/                  必须在首帧前运行的薄适配器
```

这里按功能域分类，`inline/` 是唯一的执行时机边界。它存在是因为主题首帧、路径列占位、根入口选中和画幅恢复必须在普通延迟脚本之前运行。内联适配器直接复用所属功能域的函数，不维护第二套业务算法。

没有建立 `api/`、barrel export、模块注册器或通用事件总线。调用者知道所需能力时直接 import 对应模块，避免再通过 mode、caller 或字符串注册表间接分派。

## 页面装配路径

```text
Hugo 页面模板
├─ baseof.html
│  ├─ inline/*：首帧状态与占位
│  ├─ main.js：根入口、主题、跨页面语言返回
│  ├─ browse/path-entry.js：具备路径列能力的页面
│  ├─ pwa/*：按 service_worker.mode 装配
│  └─ prefetch/runtime-entry.js.tmpl：按 prefetch_runtime 装配
├─ collection sort partial
│  └─ browse/collection-sort.js
└─ 专用页面
   ├─ preferences/*
   ├─ pages/*
   ├─ updates/page.js
   └─ prefetch/debug-page.js
```

Hugo/esbuild 会把 import 图打包为少量带指纹的页面资源。源码文件的数量不等于浏览器请求数量。

## J1：删除无效分支

J1 删除了无消费者的 export、不可达的旧事件分支和专用页面中的无用途依赖。小模块只在职责清楚时保留；没有为了追求文件数继续合并语言状态、主题状态或页面入口。

`main.js` 只承担三项全站职责：根入口同步、主题偏好同步、一次性语言返回。微信 Android 字体处理仍是明确的全站环境修正。

## J2：路径列只有一次数据解释与一次完整呈现

每个可浏览页面由 Hugo 输出 `data-entry-breadcrumb-sources`。其中只包含该页面可能使用的来源、当前集合行和祖先集合行。浏览器在输入边界将紧凑 payload 解码为统一对象形状，初次路径列与后续列内排序共用这份内存模型。

```text
读取当前 HTML 的页面数据
→ 一次解码并建立当前页 source index
→ 用 from / sort / sorts 计算入口与各层状态
→ 同步呈现完整路径列
→ 排序只替换目标列并更新必要链接
```

旧的 preview、fragment fetch、运行时 manifest 等待和二次完整重画已经删除。首帧 skeleton 只负责在正式脚本执行前稳定几何位置，不解释业务数据。

集合页和文章页共用来源、行、排序与 URL 状态模块，但保留各自直接的 orchestration：

- 文章页按精确 `from` 选择已发布来源。
- 深层集合页在 `from` 只命名祖先时，使用当前集合 source 重建祖先列，当前集合仍留在主列。
- 无关的 `from` 不触发这个集合祖先 fallback。

## J3：删除重复的运行时数据交付

检查更新页的多语言文案来自对应 `content/updates/check/index*.md`，由 `feature-updates/panel.html` 同时渲染初始 HTML 和本页 `data-site-update-copy`。构建版本与时间也直接写入本页。

已经删除：

- 全站 runtime manifest；
- 每语言 runtime i18n JSON；
- `__fragments/` 与 `_items.json` 发布；
- 为上述资源存在的缓存路由、HTML 属性与浏览器 fetch 逻辑。

Service Worker 仍从首次导航 HTML 的 `href` 和 `src` 扫描并预热当前页资源。更新文案作为页面 HTML 的一部分进入版本化导航缓存，不需要独立运行时接口。

## J4：功能归属和策略事实源

浏览代码集中在 `browse/`。源码命名描述实际行为：

- `path-entry.js`：路径列运行入口；
- `path-render.js`：路径列 DOM 呈现；
- `collection-sort.js`：主集合排序；
- `collection-navigation.js`：主集合表头与条目链接的 URL 状态投影；
- `sort-policy.js`：DOM 行和内嵌行共用的排序规则；
- `collection-source.js`：页面 collection source 输入边界；
- `navigation-state.js`：`from`、`sort`、`sorts` 状态。

预取 runtime 与 `/prefetchdebug` 共用：

- `prefetch/policy.js`：环境别名、mode、slot 所有权、优先级、去重和动作规划；
- `prefetch/browser.js`：页面 JSON、能力检测和候选链接收集。

runtime 自己保留传输、session gate 和交互监听；诊断页自己保留展示。两者共享“应该做什么”，不混合“如何执行”和“如何解释”。Hugo 模板仍按配置裁剪运行 bundle。

PWA 的缓存名称与归属集中在 `pwa/cache-names.js`。enable worker、disable worker、页面停用入口和激活失败恢复共用同一判断：

- `nav-html-*`：版本化导航 HTML；
- `asset-versioned-*`：版本化非指纹资源；
- `asset-fingerprint`：可跨版本复用的指纹资源；
- `asset-static-*`：只为真实旧客户端迁移保留的旧缓存前缀。

`off` 与 `disable` 仍有不同语义：`off` 不注入 PWA 代码；`disable` 必须注销既有根作用域 worker 并清理受管缓存。发布协议 `/sw.js`、缓存前缀和 worker 消息类型保持稳定，源码目录名可以演进。

## 稳定边界

源码重组不改变以下外部契约：

- URL 状态：`from`、`sort`、`sorts`；
- Service Worker 地址：`/sw.js`；
- Worker 消息：`SKIP_WAITING`、`WARM_NAV_BATCH`；
- 缓存桶命名；
- 首帧 data 属性、CSP hash 与页面模板装配点；
- `banyan:language-return` 的会话存储语义。

这些名称跨页面、跨执行环境或跨部署版本使用。内部函数和文件名则以当前职责为准，不为旧源码名称保留别名层。

## 验证

结构修改至少执行：

```powershell
bun run check:navigation
bun run check:prefetch
bun run check:collections
bun run check:browser:latest-temp
bun run check:browser:speculation:latest-temp
bun run check:browser:sw-disable
```

修改 PWA 时还要验证连续两版 enable 升级、enable → disable、离线导航、首次页面引用资源预热，以及 `/sw.js` 的 no-cache 响应头。生产 HTML 审计继续约束首页、全部文章和产品页的原始体积、gzip 体积、内嵌路径数据固定成本与每行增长成本。

J1～J4 的判断标准是单一事实源和局部行为：删除重复解释和重复交付，保留首帧、浏览器历史、离线与旧客户端升级所需的真实边界。黑白主题色 6C 属于后续视觉工作，不与这次 JavaScript 结构调整混合。
