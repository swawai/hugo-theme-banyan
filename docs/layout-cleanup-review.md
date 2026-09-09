# 布局深度清理报告

2026-09-09｜分支：`codex/flatten-navigation`｜状态：已实施并通过完整回归

## 结论

入口展平后的主架构可以继续沿用。当前复杂度主要来自已经失去调用方的旧模板、已无消费者的内容字段，以及仍把内部细节暴露成公共接口的小残留。本轮直接删除这些旧路径，没有增加兼容层，也没有重写仍承担状态恢复的 breadcrumb、排序、横向画幅或 Service Worker 系统。

清理后的维护心智更集中：

- 根入口由真实根页面的 `root_nav`、`weight`、`linkTitle` 决定。
- 集合页由页面或祖先的 `list` 决定展示方式，由目录或 Hugo taxonomy 决定成员。
- 页面模板由显式 `layout` 或现有 cascade 选择，不重复填写对当前渲染无影响的 `type`。
- 图标的 SVG 几何属于 `data/icons.toml`，CSS 只负责尺寸、对齐和颜色呈现。
- JavaScript 只导出跨模块或测试真正使用的符号。

## 证据

清理前检查了 152 个 partial、11 个默认布局、39 个 JavaScript 文件和 23 个 CSS 文件，并追查 Hugo 隐式入口、动态 partial、内容声明、资源副作用和测试引用。

1. 用临时 layouts 覆盖层把 13 个候选模板替换成“被调用即 `errorf`”；真实根内容三语言构建成功。
2. 候选模板实验与固定时间基线比较全部 577 个 Hugo 产物，无新增、无缺失、无字节差异。证据在根目录 `temp_workspace/layout-audit/probe-result.json`。
3. 移除旧 taxonomy 首页字段及空 `site-header.css` 的实验同样得到 577 个产物逐字节一致。证据为 `temp_workspace/layout-audit/metadata-result.json`。
4. 46 份页面级 `type` 声明移除后，574 个产物逐字节一致。三语言 `changelog/index.html` 的唯一差异是被修改的内容文件暂时没有 Hugo `GitInfo` 全局提交行；页面模板、内容和资源没有语义差异，提交后 Git 来源恢复。随后一并移除 `/d/` 三语言 cascade 中同样冗余的 `type: post`，总计删除 49 处 `type` 声明。
5. 实施删除后重新生成 partial 依赖图，无调用 partial 数量为 0。内容作者 shortcodes 作为主题接口保留，不按根站当前使用次数误删。
6. 使用 Hugo `--logLevel info` 重建并检查完整日志；活跃模板与内容已迁移到 `hugo.Sites`、`hugo.Data` 和 `cascade.target`，不再产生 Hugo 0.157 的弃用警告。

## 已执行清理

### 1. 删除退役渲染链

删除旧 `section-index` 布局、旧首页快捷集合、旧 breadcrumb 包装、旧 taxonomy 逻辑路径、旧资源包装和调试模板，共 13 个经实验确认未执行的布局／partial；同步删除 `breadcrumb/page-column-items.html`（当时名为 `page-item-menu.html`）中唯一服务 `section-index` 的分支。样式按需装配后再删除仍在执行但只返回一个字段的 `page-style-flags.html`，合计退役 14 个模板入口。

删除只有注释的 `assets/css/site-header.css`，并从样式装配中移除该空位置。

### 2. 删除无效声明

taxonomy 根不再要求或声明 `show_in_home`、`home_weight`。它们唯一的消费者是已删除的首页快捷列表；第一列继续只读取页面 `root_nav` 和 `weight`。

从根项目和主题内容中删除 49 个冗余 `type: page`、`type: my`、`type: frameworks`、`type: post`。这些页面已有显式 `layout`；Xvenv 则从 `/d/` cascade 取得 `article-page`。主题模板、脚本和检查均不读取 `.Type` 或 `Params.type`。

同步删除未使用的 `products_empty` 三语言文案、CSS 自定义属性和注释掉的实验规则；保留仍由产品价格、外观 choice 和 Hugo Chroma 动态使用的规则。

### 3. 收拢仍在工作的实现

`head-styles.html` 先解析当前页面 variant，再只拼接这一份 CSS。目标文件名和列表职责不变：`grid-base` 仍是单列基底，directory、products、all 只追加各自列定义。

页面 shell 只输出实际参与布局的 `page-shell--has-breadcrumb-tail`；默认 rail 网格直接属于 `.page-shell`。语言和“我的”的 stroke、fill、线宽等属性移入 `data/icons.toml`，与外观图标使用同一事实源。

合并 breadcrumb 首帧脚本内两个完全相同的来源查找函数；把仅在自身模块使用的 10 个 JavaScript export 收回为局部符号，保留测试直接调用的公开函数。

把 Hugo 已弃用的 `.Site.Sites`、`.Site.Languages`、`.Site.Data` 和 `cascade._target` 改为当前 API。构建中同时发现一次并发渲染竞态：某个页面先写入全局 `buildVersion`，另一个页面便会把它误当作整组构建时间已就绪，偶发生成空 `buildTime`。现在先写入两种构建时间，最后写入 `buildVersion` 作为就绪标记，并让公开 HTML 检查器校验两种时间格式，使同类错误在构建阶段直接失败。

### 4. 同步当前文档

README、taxonomy、列表、slots、发布迁移及导航计划已改为当前契约，不再把退役字段写成必填。`exampleSite` 按项目约定留待专门阶段处理，本轮没有修改。

## 明确保留

- `baseof.html` 仍是全部页面的公共骨架；资源、CSP、部署文件发布副作用都在实际执行。
- `_headers`、`_redirects`、`edgeone.json` 的 `RelPermalink` 局部变量虽不被后续读取，但访问本身负责触发 Hugo Pipes 发布，因此保留并在原处注明。
- 动态 `model-home-auto`、`model-page-auto`、`model-taxonomy-auto` 由 strategy 动态选择，不能按静态字符串误删。
- breadcrumb pending、skeleton、preview、runtime 分别承担首帧和异步恢复。
- `canvas-position.js` 保证新增列向右扩展时，已有画幅不突然跳走。
- SW disable 脚本负责清理历史安装状态；旧 URL redirects 维护外部书签。
- 首页 58rem media query 只微调品牌动画内部锚点，不切换页面列结构，继续保留。
- `buildBreadcrumbRowHref`、`buildPreviewCurrentItem` 的 export 供独立契约测试直接调用；Chroma token、`.sr-only`、首页内联 SVG class 与 choice 动态 i18n key 也都有非字面量消费者，均不是可删死代码。

## 最终验收

最终三语言生产构建位于根目录 `temp_workspace/public/2609091115-layout-cleanup-release-fixed`：EN 67、ZH 65、ZH-TW 64 页，CSP 后处理成功。141 个公开 HTML、agent readiness、导航状态与 entry-from 契约均通过；asset manifest 的 `buildTime`、`buildTimeISO`、`buildVersion` 均有值且格式有效。

集合契约通过 directory、all、products、name 四种列表的三语言成员、继承、Lastmod、排序、图标、SSR、刷新、前进后退及非法声明校验；报告目录为 `temp_workspace/collection-contract-z9fgI6`。

完整浏览器回归 39/39 通过，报告为 `temp_workspace/regression/260909111538-browser/report.json`。覆盖桌面／窄屏／触摸画幅、首帧、横向位置、语言返回、外观同步、根入口、隐藏探索路径、产品来源、组合排序、更新入口及 Service Worker。浅色、深色和语言页截图确认图标描边与对齐保持一致。

## 面包屑协议收尾（2026-09-09）

进一步核对发现，旧下拉控件已移除，但模型仍返回无消费者的样式标签，并沿用 `menu` 作为兄弟条目名称。本次将内部协议与当前横向列结构对齐：

- 删除三个路径生成器中的 `variant: trail` 和 `strategy` 返回字段，以及 canonical 模型中无消费者的 `strategy` 字段。按 Hugo 页面种类选择生成器的内部逻辑继续有效。
- `page-item-menu.html`、`taxonomy-item-menu.html`、`menu-items-from-entries.html` 分别更名为 `page-column-items.html`、`taxonomy-column-items.html`、`column-items-from-entries.html`；两个调用方都提供固定 `text`、`href`，不再传 `text_key`、`href_key`。删除分类转换中的未使用局部变量。
- 路径数据的 `menu` 统一为 `column_items`，JavaScript 函数改为 `buildBreadcrumbColumnItems` 等名称。静态渲染、图标注册、浏览器来源精简、预览、重绘、排序和测试同步切换，没有增加旧字段兼容读取。
- 删除 `link.html` 无调用方的 `ariaHaspopup`、`ariaExpanded` 参数；保留用于验证下拉控件不会重新出现的浏览器断言。预取配置中的 `menu` 和微信的 `menu:setfont` 是独立有效接口，不属于本次列数据更名。
- 更新 [面包屑模型](breadcrumb-models.md) 与 [导航状态](navigation-state.md)，移除对旧站点页、页脚和宽度模式的现状描述。

清理前后生产构建分别为 `temp_workspace/public/2609091142-breadcrumb-before-cleanup` 和 `temp_workspace/public/2609091143-breadcrumb-column-cleanup`。只归一化实际构建时间、版本、资源哈希与相应的 runtime 完整性校验值后，141 个 HTML、22 个 CSS、60 份 `_items.json` 均一致，结果为 `temp_workspace/breadcrumb-cleanup-comparison.json`。141 页 HTML、agent readiness 和导航状态检查通过；四种列表三语言集合契约通过，目录为 `temp_workspace/collection-contract-MCmzyI`。

完整浏览器回归 39/39 通过，无跳过项；报告为 `temp_workspace/regression/260909114322-browser/report.json`。覆盖 SSR／预览／重绘、列排序隔离、目录／标签／产品来源、刷新和前进后退、三种宽度、真实触摸事件，以及清理前版本升级到新版本。实际布局和样式保持一致，`exampleSite` 未修改。
