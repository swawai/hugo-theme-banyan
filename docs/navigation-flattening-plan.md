# 导航入口展平纲要

2026-09-09｜分支：`codex/flatten-navigation`｜状态：第 5 步及布局深度清理已完成；第 6 步配色收敛尚未开始

## 当前增量：布局深度清理

面包屑协议收尾：路径列的兄弟数据由 `menu` 改为 `column_items`，三个菜单命名 partial 改为列条目命名，模板／JS／测试同步迁移；删除未被读取的 `variant`、`strategy` 返回标签和链接的弹出／展开参数。首页、真实目录、taxonomy 继续负责各自路径来源，共用唯一的普通列渲染器。验证记录见 [清理报告](layout-cleanup-review.md#面包屑协议收尾2026-09-09)。

展平入口和统一列表稳定后，已按 [布局深度清理报告](layout-cleanup-review.md) 收掉旧主路径，而不是继续保留兼容层：删除未执行的 `section-index`、旧首页快捷列表及 11 个无调用 partial，移除空样式文件；分类根不再填写无消费者的 `show_in_home`／`home_weight`；显式 `layout` 已承担渲染选择的内容不再重复声明 `type`。

仍在工作的实现只做职责收敛：页面先确定当前 CSS variant，再只拼接这一份资源；语言、外观、我的图标的 SVG 几何统一由 `data/icons.toml` 声明；页面 shell 只保留实际被 CSS 使用的状态类；JS 模块不再导出仅供自身调用的符号。活跃模板与内容同步迁移到 Hugo 当前的 `hugo.Sites`、`hugo.Data`、`cascade.target` API；构建版本改为最后写入的就绪标记，并新增构建时间完整性检查，消除并发渲染偶发生成空时间的竞态。动态 breadcrumb、来源恢复、横向画幅位置、排序、SW 停用路径、迁移跳转和内容作者 shortcodes 均保留。

失效模板的 fail-if-called 覆盖实验及旧分类字段实验均得到 577 个 Hugo 产物逐字节一致；移除冗余 `type` 后 574 个产物逐字节一致，三份更新记录仅因工作区文件变脏而暂时失去 Hugo GitInfo 的全局提交行，提交后恢复。最终生产构建、HTML、集合、导航和浏览器回归记录见清理报告。

## 前一增量：名称列表与更新入口

用户已确认以 `/updates/` 收纳“检查更新”和“更新记录”，采用真实内容子页。列表基础已获用户确认，本轮迁移内容和更新入口，不在中间增加临时专用列表。

1. **名称列表与样式拆分（已验收）**：增加 `list: name`，仅显示图标和名称，默认名称升序，完整复用集合来源、继承、排序、路径列和历史。`grid-list.css` 改名为 `grid-base.css` 并成为单列基底；目录三列配置移到 `grid-directory.css`，all／products 只叠加各自列布局。choice 共用基底，保留原生链接／按钮及各自功能逻辑，不增加排序。不引入 `list: base`、`list_columns` 或 `grid-name.css`。
2. **更新入口迁移（已实施，待用户确认）**：主题 `content/updates/_index*.md` 使用 `layout: article-list`、`list: name`、`root_nav: true`；`updates/check/index*.md` 使用 `update-check` 布局承载现有检查操作，`updates/changelog/index*.md` 承载更新记录，项目同路径内容同步迁移。检查页内显示实际版本／状态，版本为普通文本，不再嵌套更新记录链接；相关 `changelog_page` 字段和模板耦合已删除。名称列表不伪造运行时更新时间。旧 `pwa/`、`site/` 内容入口及 `pwa-page` 布局已删除，第一列合并为“更新”，共 14 项；模型、引用、sitemap、导航及对应测试已迁移。`assets/site/pwa/` 资源路径不变。更新记录保留 `/changelog/`，旧 `/pwa/`、`/site/` 通过根部署规则分别永久跳转到检查页和更新列表，覆盖三语言与有无尾斜杠。

列表基础验收：生产构建 `temp_workspace/public/2609090126-name-list-base` 的 141 页 HTML 审计通过；10 项浏览器回归通过，报告为 `temp_workspace/regression/260909012714-browser/report.json`，覆盖画幅宽度、系统页面、入口、产品路径、排序隔离与视觉对齐。四种列表 × 三语言集合契约及 name 的目录／分类／汇总、升降序、进入文章、刷新、前进后退验证通过，产物为 `temp_workspace/collection-contract-umloRE`。已查看名称主列、文章路径列、目录及语言页截图。该阶段仅交付列表基础，未迁移业务内容。

更新入口验收：生产构建 `temp_workspace/public/2609090141-updates-entry-final` 的 141 页 HTML 审计通过。完整 39 项浏览器回归中 38 项直接通过（`temp_workspace/regression/260909014134-browser/report.json`）；一项仍点击旧 site 入口的测试已改为 updates，单独复测通过（`temp_workspace/regression/260909014352-browser/report.json`）。覆盖三语言双子项列表、排序、直接／来源进入、刷新／历史恢复、首列 14 项、离线检查及重试、ready 时应用更新和重载、保留路径列与选中项、旧导航缓存清理和 sw.js 响应头。另验证三语言无 JavaScript 的原生子页导航、12 条生成的永久跳转、旧页面产物删除及更新记录 URL 保留。截图在 `temp_workspace/updates-preview/`，已查看列表、检查页及回归生成的新版本就绪状态截图。

干净效果图为 `temp_workspace/name-list-preview/directory-as-name.png`：仅在临时覆盖层将真实 `/d/` 改成 `list: name`，没有加入测试文章，也未改动正式目录声明。

以下为之前各阶段的设计与验收记录；当前增量以上述两步为准。

已确认：现有面包屑通过 `from` 保存进入路径，结合 `sort/sorts` 恢复排序，并已有根入口及各列选中逻辑。本次复用该机制，将结果接到统一第一列，清除主菜单另用 `nav_primary` 判断归属的分支。

第一列复用第二、三列的 `grid-title-cell.html`、`collection/item-content.html` 和 `collection-list.css`，沿用行结构、图标、间距、悬停及 `.is-current` 选中态；适配容器与断点限制。统一入口列表保持完整，来源变化只更新选中项，避免原根菜单渲染函数把它替换成局部菜单。

目标入口：文章 - 全部、文章 - 分类、产品 - 全部、产品 - 分类、语言、外观、我的、关于、更新、RSS 订阅、微信、GitHub、备案（图片图标＋粤ICP备2024338434号）、首页（© 2026 Swaw）。

实施顺序：

1. **站点归组（已完成）**：建立 `site/`，同步迁移项目与主题的关于、更新记录及项目微信页面，保留原网址，更新内容路径引用。
2. **产品整理（已完成原生分类迁移）**：已建立产品全部及分类入口，产品内容保持一份。固定分类规则已由 5C 替换为作者自由声明的 Hugo 分类。
3. **系统页面（已完成）**：完成语言、外观及现有“我的”页接入，再完成站点页的版本与更新操作，同属第 3 步验收。复用已有偏好和更新逻辑，将操作逻辑与下拉菜单的 DOM、脚本加载条件分开；全站主题初始化、跟随系统、语言推荐及更新提示继续有效。语言切换留在对应语言的设置页；“返回上一页”使用浏览器原生历史，不传递或另存原阅读地址。“我的”保持现有功能范围，不扩成账户系统。旧控件呈现在第 4 步删除，共存期间共用操作逻辑。
4. **入口切换（已完成）**：内部按“根入口模型 → 第一列及选中状态切换 → 旧实现清理”推进，作为完整一步验收。合并 `Home.Pages` 与父页面为首页的分类法根，使用 `LinkTitle`／`Title`、`RelPermalink`、`weight` 生成十个入口，补齐前四项的多语言名称与顺序。不能只取 `Home.Sections`，也不能只取 `Site.Pages`：后者不包含 `build.list: local` 的系统操作页。静态模板、首帧预览、运行时使用同一份入口定义；第一列只渲染一份完整列表，已有有效 `from` 只决定选中项，直接访问按内容祖先确定入口。同步处理第一列列宽、间距和页脚位置，并将更新提示接到“系统－站点”入口。删除旧导航片段、菜单归属和导航专用声明；十个根入口均使用普通页面链接，集合定义、产品属性及仍有用途的正文／页脚配置保留。
5. **布局与列表修正（进行中）**：统一横向列结构已实现；下面的 5A 独立实施和验收，5B、5C 按依赖顺序完成后共同验收。撤销“普通新访问自动让主列可见”的旧要求：沿列打开内容时，保留已有列的位置，新增列向右扩展。继续复用来源、排序和原生历史机制。
6. **配色收敛（未开始）**：前面的修正经用户确认后，统一黑白灰及交互状态，保留清楚的选中态和键盘焦点。

每步保持可运行并独立提交，用户确认后再进入下一步。复用现有回归，验证多语言、进入路径、排序、前进后退和系统操作；补充新入口及各宽度下的视觉核对。主题能力在本目录所属主题实现，业务内容在项目根目录同步；使用根目录内容测试，忽略 `exampleSite`。

当前行动安排（2026-09-09，以下规则优先于后面的历史记录）：

入口显式声明：根页面只有顶层 `root_nav: true` 才显示，未声明默认隐藏。三语言可见根页面及首页已补齐声明，前四项采用“文章 - 全部、文章 - 分类、产品 - 全部、产品 - 分类”，权重依次 10、20、30、40。目录与阅读目的保留真实页面、集合数据和文章底部链接，第一列隐藏后共 15 项。隐藏来源及直接访问目录下文章时，第一列无选中项，右侧仍显示真实路径；不新增菜单归属映射。仅在 `navigation/root.html` 过滤展示，完整根模型不变，无新增 JS 或样式分支。下面 17 项入口等记录描述此前步骤。

显式入口验收：生产构建 `temp_workspace/public/2609090047-explicit-root-navigation-fixed` 的 141 页 HTML 审计通过，6 项相关浏览器回归通过（`temp_workspace/regression/260909004745-browser/report.json`），覆盖三语言显示名称与顺序、隐藏来源首帧／运行时选中、底部元信息进入分类、排序／刷新／历史，以及三种宽度下的统一布局。集合契约检查通过（`temp_workspace/collection-contract-Ho6B9d`），验证 `true`、`false`、缺省、字符串声明、普通子项不被提升、隐藏页面仍输出及目录主动加入入口。已查看文章全部、文章分类和隐藏阅读目的路径截图。

关于与 PWA 状态提升为普通根入口：项目及主题关于内容迁至 `content/about/`，主题 PWA 内容迁至 `content/pwa/`，三语言权重分别为 95、96，排在我的之后、站点之前。关于保持 `/about/`，PWA 使用 `/pwa/`；分别保留个人小花图片和 `↻` 图标。第一列自动依据真实根页面生成 17 项，站点仅剩更新记录，不新增菜单白名单或布局分支。同步更新 sitemap、llms.txt 的关于内容引用与 PWA 文案模型的页面引用；更新记录仍指向 `/site/changelog`，`assets/site/pwa/` 资源目录保持原位置。下面图标验收记录中的 `content/site/about/`、`content/site/pwa/` 是迁移前位置。

本次迁移验收：生产构建 `temp_workspace/public/2609090027-about-pwa-roots-to` 的 141 页 HTML 审计通过；11 项浏览器回归全部通过（`temp_workspace/regression/260909002748-browser/report.json`），覆盖三语言根入口、图标、刷新／历史、系统返回，以及 PWA 离线／重试、发现新版本、应用并重载、清理旧导航缓存和更新提示。已查看站点、关于、PWA 三张截图，核对 sitemap 与 llms.txt 三语言关于链接；等待用户确认布局。

关于条目图标：项目三语言 `content/site/about/index*.md` 声明 `icon: { image: "site/brand/lib/bornwhy.svg" }`，沿用用户整理后的个人小花头像路径。该业务图标只配置在项目内容，主题默认关于页保持通用；图片通过现有发布器生成哈希资源，使用共用 15×15px 图标尺寸，点击仍打开关于页。生产构建 `temp_workspace/public/2609090018-about-flower-icon` 的 141 页 HTML 审计与 `system-site-directory` 回归通过（`temp_workspace/regression/260909001836-browser/report.json`），覆盖三语言主表图标解码、尺寸，以及路径列、排序／刷新／历史中的同一资源地址；已查看实际截图。

PWA 条目图标：主题三语言 `content/site/pwa/index*.md` 声明 `icon: { text: "↻" }`，沿用当前 15px 字号和 1.5rem 图标占位；目录主表、文章路径列及运行时数据使用相同字符，不增加特殊样式。生产构建 `temp_workspace/public/2609090012-pwa-update-icon` 的 141 页 HTML 审计及 `system-site-directory` 回归通过（`temp_workspace/regression/260909001233-browser/report.json`），验证三语言目录、路径列及排序／刷新／历史中的字符图标。

说明页目标链接：RSS 订阅地址、备案页两个查询链接、GitHub 头像和文字链接均使用原生新标签打开，第一列入口仍在当前标签打开说明页。RSS 短代码为既有 `link.html` 传入 `target="_blank"` 和 `rel="noopener noreferrer"`；GitHub／备案正文使用小型 `new-tab` 短代码复用同一渲染器，主题 GitHub 默认页同步采用。保留 `unsafe: false`，不增加 JS 或全站链接重写。生产构建 `temp_workspace/public/2609082309-info-links-new-tab` 的 141 页 HTML 审计及 `system-site-directory` 回归通过（`temp_workspace/regression/260908231037-browser/report.json`）；三语言共 15 次实际点击验证新标签 URL、`window.opener` 为空、原页面 URL 保持，以及根入口仍在当前标签打开。测试拦截目标响应以排除外站和 XML 查看器差异，RSS 实际 XML 仍独立读取校验。

GitHub 账号与头像：项目三语言 GitHub 说明页仅展示 SwawHQ 组织账号，撤掉表格、个人账号与介绍文案，正文只保留可点击的头像及 `github.com/SwawHQ` 链接。清理重复资源后，头像统一引用项目 `assets/site/pwa/favicon.svg`，通过现有 `asset` 短代码与站点入口、浏览器图标共用哈希资源；尺寸声明为 64×48，保持 SVG 的 4:3 图形比例。关于页同步只保留 SwawHQ。无新增模板、样式或运行时分支。

共用 favicon 验收：生产构建 `temp_workspace/public/2609082329-github-shared-favicon` 的 141 页 HTML 审计及 `system-site-directory` 回归通过（`temp_workspace/regression/260908233010-browser/report.json`），三语言头像解码、比例、同 favicon URL 和新标签链接均通过，已查看截图。未恢复或提交用户此次资源清理；旧 `site/brand/favicon.svg` 引用已清除。

GitHub 简化验收：生产构建 `temp_workspace/public/2609082304-github-simple-link` 的 141 页 HTML 审计与 `system-site-directory` 浏览器回归通过（`temp_workspace/regression/260908230415-browser/report.json`）。三语言确认无表格、仅一个组织头像、头像及 URL 均可点击，关于页不再展示个人账号；已查看最终截图。

联系与订阅入口：只将微信、GitHub、RSS 从 `content/site/` 提升到内容根层级，主题默认页与项目覆盖页同步迁移。三语言依次声明 `weight: 101/102/103`，沿用 `wechat/github/rss` SVG 图标；微信新增 `icon: wechat`。第一列仍按真实根页面生成，共 15 项，不修改导航模板或增加菜单声明。站点保留关于、更新记录、PWA 状态，Logo 与现有目录交互保持。微信继续 `/wechat/`，GitHub、RSS 改为 `/github/`、`/rss/`；sitemap 同步引用新内容路径，正文外部链接与当前语言 RSS 解析保持。

联系与订阅入口验收：生产构建 `temp_workspace/public/2609082242-contact-root-entries` 的 141 页 HTML 审计及 4 项相关浏览器回归通过（`temp_workspace/regression/260908224256-browser/report.json`）。覆盖三语言 15 项根导航、微信 SVG 与二维码解码、GitHub 正文目标、RSS 实际地址及 XML、站点剩余三项排序和路径列，以及根入口选中、刷新、历史与设置返回。已查看站点和微信页截图；当前局域网预览服务未运行，本轮使用测试构建验证。

站点 Logo：三语言站点入口声明 `icon: { image: "site/pwa/favicon.svg" }`，通用图片图标改为调用现有 `asset/publish.html`，复用页面 bundle／全站 assets 的既有解析和哈希发布规则。入口 Logo 与 HTML 的 favicon 共用 `/site/pwa/favicon.<sha256>.svg`；不复制 Logo、不增加发布器或 JS 分支。图片目录默认值和自身声明均支持 assets，既有 ICP bundle 图片继续使用原哈希路径。

站点 Logo 验收：集合契约 `temp_workspace/collection-contract-BeFSY5` 覆盖 assets 自身／默认图标、三语言 SSR／运行时、刷新和历史，以及显式 bundle、静态／远程 URL、缺失及非图片资源校验；确认全站 Logo 只生成一份哈希资源。生产构建 `temp_workspace/public/2609082213-site-logo-assets` 的 141 页 HTML 审计、图片发布检查和 2 项相关浏览器回归通过（`temp_workspace/regression/260908221328-browser/report.json`）。局域网预览核对三语言同一 favicon URL、15px 图标尺寸、文章进入后的选中态及浅色／深色截图，产物在 `temp_workspace/site-logo-live/`。

入口名称简化：语言、外观、我的、站点三语言页面通过 front matter 的 `linkTitle` 声明简称，第一列统一去掉“系统－／System -”前缀；页面自身 `title` 继续用于页内标题，无需修改导航模板。

备案名称与链接补齐：三语言入口显示完整 `粤ICP备2024338434号`；正文备案号自身加粗并链接至 `https://beian.miit.gov.cn/`，原有查询网站说明链接继续保留。

图片图标与入口排序：备案入口改为 `weight: 105`，排在版权入口 `110` 前面；三语言声明 `icon: { image: "0.webp" }`，资源来自项目 `content/icp/0.webp`。通用图标增加图片值，声明时以所属页面解析，再复用现有 `page-resource/publish.html` 发布到 `/media/content/icp/0.<sha256>.webp`；主表、路径列、图标默认值继承与 JSON 均保留同一地址。图片使用共用占位及 `1rem` 图形尺寸，保持比例；备案页保留 `build.publishResources: false`，只发布哈希资源。不改变缓存策略或新增图片发布链。

图片图标验收：集合契约 `temp_workspace/collection-contract-vNQ8sR` 覆盖三种列表、三语言、自身与目录继承图片、资源哈希及原始字节、SSR／运行时、刷新和历史，并验证空值、缺失、远程及非图片声明构建失败。生产构建 `temp_workspace/public/2609082140-image-icons-final` 的 141 页 HTML 审计、图片发布检查及 5 项相关浏览器回归通过（`temp_workspace/regression/260908214029-browser/report.json`）。局域网预览完整重建后核对三语言顺序、图片解码、15px 尺寸及截图，产物在 `temp_workspace/image-icons-live/`。

备案入口调整：项目备案页从 `content/site/icp/` 移到 `content/icp/`，成为首页的直接子页；三语言均声明 `linkTitle: "ICP备2024338434号"`、`icon: { text: "粤" }`、`weight: 120`。首页入口统一 `weight: 110`，两项排在第一列最后；站点目录回到六个子项。沿用普通文章布局与根导航，不增加专用模板或页脚，sitemap 同步引用 `/icp`。已向用户说明首页底部中央的公示要求；用户选择第一列末尾的普通入口布局，该选择不等同于确认满足规定位置。

备案入口验收：生产构建 `temp_workspace/public/2609082119-icp-root-entry` 的 141 页 HTML 审计通过；站点目录、系统返回、根导航及来源选中共 4 项相关回归通过（首次运行发现一处旧的 11 项数量断言，改为预期入口数组长度后复测通过）。实际局域网预览核对三语言首页、备案页、站点目录与截图，产物在 `temp_workspace/icp-root-live/`。

字符图标字号微调：移除旧语言短标记遗留的 `0.75em`，字符直接继承条目字号。实测 `EN` 在 15px 字号下宽约 20.5px，因此共享占位统一为 `1.5rem`，SVG 图形维持 `1rem`；三语言文字起点一致，EN 与名称间保留约 3.3px。保留用户在中文与繁体首页设置的 `weight: 110`。生产构建 `temp_workspace/public/2609082052-character-icon-size` 的 HTML 审计与 3 项相关回归通过（`temp_workspace/regression/260908205240-browser/report.json`）；实际预览截图及测量在 `temp_workspace/character-icon-size/`。本次只微调共用样式，不进入后续配色步骤。

本步验收记录：最终生产构建 `temp_workspace/public/2609082014-home-entry-reviewed` 的 141 页 HTML 审计和导航检查通过；集合契约 `temp_workspace/collection-contract-GLRG0o` 覆盖三语言／三种列表、字符继承与 SVG 覆盖、纯文本转义、来源 JSON、静态路径列、刷新和历史，以及非法声明。完整 38 项浏览器回归先通过 37 项，发现语言图标槽缺少原有装饰性辅助标记；补齐后包含该失败项的 4 项相关回归全部通过（`temp_workspace/regression/260908201303-browser/report.json`），另有 3 项安全检查通过（`temp_workspace/regression/260908201304-browser-security/report.json`）。实际局域网预览验证 15 个路由、9 个禁用 JS 页面、切换语言后的返回，并核对浅色／深色／窄屏截图，产物在 `temp_workspace/unified-icons-live/`。等待用户复测后再推进后续设计。

统一字符图标与首页入口：`icon`、`list_icon_folder`、`list_icon_file` 同时支持 SVG 名称和 `{ text: "©" }`。语言配置迁移到相同的 `params.icon`，移除专用 `icon_text`／`iconText` 数据通道；共享渲染与浏览器路径列保留字符大小写、按纯文本输出，SVG 继续按需打包。首页自身加入第一列，用根 `content/_index*.md` 的 `linkTitle`、`icon`、`weight` 排在第一项；首页只在访问自身时选中，其他入口及有效 `from` 保持原规则。移除重复列头首页链接、版权页脚、`slots.footer` 及其专用片段／模板／样式。首页动画布局与后续配色计划保持原范围。

页脚信息收纳：共用页脚保留现有品牌主页链接及其年份，移除微信、RSS、GitHub、备案等快捷链接的配置与渲染分支。微信继续使用既有子页；RSS、GitHub、备案新增为站点目录的真实文章页，统一 `layout: article-page`、`build.list: local`、`slots.breadcrumb: true`，目录进入时先显示说明，再由用户点击正文链接。RSS 页使用 `rss-link` shortcode 读取当前语言首页真实 RSS 输出，未增加专用列表或跳转布局。主题提供 RSS 与默认 GitHub 页，Swaw GitHub 内容与备案信息在项目根目录；根项目 sitemap 声明同步加入三个公开信息页。现在站点目录共有七个子项，首页和站点页共享的页脚均只保留品牌行。

本步验证：生产构建 `temp_workspace/public/2609081902-site-info-final` 的 141 页 HTML 审计、导航状态检查通过；4 项相关浏览器回归通过（`temp_workspace/regression/260908190154-browser/report.json`）。扩展 `system-site-directory` 覆盖三语言七个子项的默认与排序进入、刷新／前进后退、图标、品牌页脚、信息页目标链接，以及当前语言 RSS 地址与 XML 内容。实际 `192.168.1.114:5120` 预览运行相同场景并验证禁用 JS 的 21 个页面／语言组合；截图和报告位于 `temp_workspace/site-info-live/`。本步等待用户复测，品牌主页链接的后续设计暂不变。

站点操作移入真实子页：`content/site/_index*.md` 只保留普通目录声明，删除 `site_update`；移除 `baseof.html` 的整块操作追加、公共系统样式条件和根入口更新标记。三语言 `content/site/pwa/index*.md` 新建「PWA 状态」页面，由 `pwa-page.html` 明确渲染版本、检查按钮和状态，并声明普通路径栏。`site_update` 文案及更新记录引用随功能移入子页，仍同时供静态界面与 runtime i18n 使用。按钮称为「检查更新」，ready 时为「立即更新」，不宣称同步用户数据；更新引擎与缓存策略未修改。没有可见按钮的页面沿用既有原生更新确认，PWA 页在面板内操作。语言、外观页的返回按钮保持各自布局调用，站点目录没有返回按钮或设置页 URL 清理行为。

新增默认 PWA 页填写实际创建日期 `2026-09-08`；当前根项目的 Hugo Git 信息不覆盖主题默认内容，因此该页 `.Lastmod` 按既有 `:default` 规则取创建日期，不为 PWA 新增日期逻辑。目录、分类与文章继续共用上一小步的更新时间规则。

本步验证：38 项完整浏览器用例中 37 项一次通过；一条仍把站点目录视作设置页的旧 URL 清理断言已修订，单独复测通过（`temp_workspace/regression/260908184215-browser/report.json`、`temp_workspace/regression/260908184409-browser/report.json`），3 项安全检查通过（`temp_workspace/regression/260908184335-browser-security/report.json`）。最终构建 `temp_workspace/public/2609081845-pwa-child-final` 的 132 页 HTML 审计通过，并复测站点目录、语言返回、PWA 更新。局域网预览完整重建后验证四个子页的三语言进入、排序、刷新、历史及禁用 JS 的 12 种组合，截图与报告位于 `temp_workspace/pwa-child-live/`。HTTP 局域网环境显示更新不可用，Service Worker 测试地址验证离线／重试、新版本激活、旧导航缓存清除与页面重载。

列表时间统一：目录、分类、全部文章及路径列改用 Hugo `.Lastmod`，三语言日期列改名为“更新时间／更新時間／Updated”，排序取相同时间；保留既有 `sort=date-asc/desc` URL 键。非空目录与分类延续文章最新时间汇总规则，递归目录与树形分类包含后代文章；空目录使用自身时间，无有效时间显示 `—`。沿用项目 `lastmod → :git → :default` 配置，无需逐篇补造发布日期，正文发布日期与站点构建时间维持各自含义。此前“缺失发布日期就显示 —”的说明由本规则替代。

本步验证：集合契约 `temp_workspace/collection-contract-YZQQJy` 覆盖三语言、三种列表、显式更新时间／默认日期／无时间、目录和平面／树形分类汇总、升降序进入路径列；生产构建 `temp_workspace/public/2609081815-list-lastmod` 的 HTML 与导航检查、5 项相关浏览器回归通过（`temp_workspace/regression/260908181601-browser/report.json`）。实际 `192.168.1.114:5120` 预览检查五个列表根的三语言列名，站点三个子项显示日期及排序值与 Git 一致，进入子页、排序、刷新和历史保留第二列；截图与报告位于 `temp_workspace/list-lastmod-live/`。本步等待用户复测，不推进后续布局整理。

站点目录再次收敛：按用户要求删除 `site-page.html`，三语言站点根统一声明 `layout: article-list`、`list: directory`。撤销集合配置、来源注册、路径菜单及图标审计中的站点布局分支；既有 `site_update` 声明仅负责由全站骨架附加操作区、样式和入口更新标记。下述保留专用布局的方案已被替代。验收覆盖三语言全部三个子页（微信、关于、更新记录）的默认／排序进入、第二列及选中保留、刷新与前进后退，并直接检查用户使用的局域网预览，不能只凭临时生产构建通过就交付。

本次直接请求 `192.168.1.114:5120` 复现了缺失路径栏：开发进程返回的三个子页都没有路径栏及脚本，虽内容文件已显式开启。触发 Hugo 配置完整重建（仅更新文件时间，配置字节未修改）后恢复。原地址的浏览器验证已覆盖全部九个语言／子页组合、默认及排序进入、刷新和历史；另验证禁用 JavaScript 的九页，以及 770px 微信截图，产物位于 `temp_workspace/site-shared-layout-live/`。生产构建 `temp_workspace/public/2609081800-site-shared-layout` 的 HTML、导航、集合契约和 9 项相关浏览器回归、3 项安全检查通过。验收以用户实际预览地址的最新输出为准。

站点目录统一（本次小步）：`content/site/_index*.md` 声明 `list: directory`，保留承载更新与返回操作的 `site-page` 布局，子项改用共享集合渲染。将站点页接入集合来源、排序与子页路径菜单，移除专用的 `.Pages.ByWeight` 列表；更新操作留在表格外。新增三语言回归覆盖与目录相同的列宽／行高、三列排序、真实子项、进入文章后的选中和排序、刷新及前进后退。本次不涉及首页合并、页脚迁移、新增链接条目或更新操作搬家。

站点子页显式启用 `slots.breadcrumb`；目录子项缺失发布日期时显示“—”。路径一致性测试发现旧 `_items.json` 发布会在默认语言首页重新排序其他语言的数据，修订为各语言首页直接发布本语言已有来源模型，避免主表与路径列切换顺序。生产构建 `temp_workspace/public/2609081747-site-directory-verified` 的 129 页审计、导航检查、集合契约检查通过；完整 38 项浏览器回归和 3 项安全检查通过（`temp_workspace/regression/260908174738-browser/report.json`、`temp_workspace/regression/260908174841-browser-security/report.json`）。明暗主题及窄屏截图位于 `temp_workspace/site-directory-review/`。本步等待用户验收，后续整理继续逐项确认。

内容图标声明与继承：新增 `icon`、`list_icon_folder`、`list_icon_file` 的统一处理。`list/icon-defaults.html` 为列表分别查找最近祖先的两种默认值；`list/item-icon.html` 优先选择条目自身的非空 `icon`，否则使用当前列表默认值，最终为 `folder`／`file`。不按同名字段继承 `icon`，不沿 `aggregate` 继承；普通文章误写子项默认字段或使用未定义的图标时构建报错。共享列表行、第一列、站点列表及首页快捷列表采用相同规则，路径菜单转换保留 `icon`。产品分类根与产品全部的三语言内容各声明 `list_icon_file: product`，分类子页自动继承，Xvenv 无需逐篇声明。

图标依赖由实际静态渲染及本页可用来源收集，删除每页固定预装 `file`／`folder`／`product`；缓存的来源模型保持为纯数据，依赖注册在页面渲染阶段执行。生产构建 `temp_workspace/public/2609081654-list-icons-final` 的 129 页 HTML 审计、导航状态检查通过，预算未放宽。扩展集合契约覆盖三语言、三种列表样式、独立继承与覆盖、自身图标、汇总隔离、SSR 菜单、仅另一来源需要的 SVG、刷新和历史，以及非法声明；最终验证目录为 `temp_workspace/collection-contract-kHiNG7`。完整 37 项浏览器回归通过（`temp_workspace/regression/260908165048-browser/report.json`）；最终将依赖注册移到明确的页面调用处后，4 项相关回归及 3 项安全检查再次通过（`temp_workspace/regression/260908165426-browser/report.json`、`temp_workspace/regression/260908165426-browser-security/report.json`）。三语言 15 种真实列表及进入文章后的图标已核对，截图与测量位于 `temp_workspace/list-icons-review/`。第 6 步配色仍未开始。

外观子项最终改用 SVG：Unicode 半圆和圆点在实际页面回退到不同字体，字号相同仍出现图形尺寸差异。按用户确认，`data/icons.toml` 新增 `appearance-auto`／`appearance-light`／`appearance-dark`，统一画布、圆心、半径及描边；外观布局用既有 `icon` 引用它们，替代下述 Unicode 方案。第一列云月、语言文字图标、CSS 和选择操作均沿用。生产构建 `temp_workspace/public/2609081621-appearance-svg` 的 129 页 HTML 审计及 2 项相关浏览器回归通过；三语言明暗主题、窄屏截图及几何核对完成，行高和文字对齐不变，截图位于 `temp_workspace/appearance-svg-review/`，预算未调整。

外观图标复测修订：第一列保留用户恢复到 `data/icons.toml` 的云月 `theme` SVG；三个 choice 子项通过既有 `iconText` 使用 `◐`（跟随系统）、`○`（浅色）、`●`（深色），按填充形态区分并继承文字颜色，不新增 CSS 或操作逻辑。生产构建 `temp_workspace/public/2609081606-appearance-circles` 的三语言明暗主题及窄屏截图已核对，2 项相关浏览器回归通过（`temp_workspace/regression/260908160646-browser/report.json`）。首页实测 gzip 7,054 字节；在同一 HTML 中仅替换回旧圆形 SVG 后为 6,873 字节，确认恢复云月增加 181 字节。因此首页 gzip 门槛从 7,000 调整为 7,200 字节，其他预算不变。

语言返回规则修订：在语言页明确选择语言后，返回原内容时优先打开所选语言的真实译文，替代严格恢复原语言网址的旧规则。当前标签页仅保存一次语言代码，不保存阅读地址，也不恢复 `return=`；首个非语言页消费该记录，普通导航清除记录并尊重明确网址，历史恢复则查本页 Hugo 译文映射后用 `location.replace()` 切换。返回按钮与浏览器后退均覆盖普通重建和 BFCache 恢复，保留来源、排序和锚点参数，不增加历史条目；没有译文时保留原内容并显示说明。其他标签页和无本次选择的历史访问不受全局语言偏好强制改写。不同译文的正文滚动位置不保证逐像素相同；会话存储受限时保留原生返回。

语言返回修订验收：生产构建 `temp_workspace/public/2609081534-language-return`、129 页 HTML 审计、导航状态检查、完整 37 项浏览器回归与 3 项安全回归通过。报告分别为 `temp_workspace/regression/260908153842-browser/report.json` 和 `temp_workspace/regression/260908153842-browser-security/report.json`。新增验证覆盖文章／集合的译文返回、来源与排序、反复选择、刷新、前进后退、明确英文链接、缺少译文、不同标签页和存储受限；独立启用 Chromium BFCache，确认英文及中文原页确实以 `pageshow.persisted=true` 恢复后再切换译文。首页为 20,022 字节、gzip 6,873 字节，原预算未放宽。

复测微调：用户要求切换语言后保留设置页位置，并去掉语言、外观等系统网址的 `return`。语言选项指向设置页自身的译文，保存语言偏好；所有系统入口均使用普通链接。“返回上一页”每次后退一条浏览器历史记录；新标签页没有上一页时回到当前语言首页。删除原页面译文请求及加载／失败／重试 UI、设置地址改写脚本和“我的”专用返回脚本，不改成隐藏存储原地址。旧系统网址只删除已废弃的 `return` 参数，保留其他参数、锚点及 `history.state`。此规则替代历史第 3、4 步的设置来源传递行为。生产构建 `temp_workspace/public/2609081003-clean-settings`、129 个 HTML 审计、导航状态检查及 10 项相关浏览器回归通过，覆盖三语言切换、逐页返回、排序恢复、新标签页、旧地址清理及站点更新。随后删除无用途的 shortcode 属性与语言上下文元数据；最终构建 `temp_workspace/public/2609081007-clean-settings-final` 再次通过 HTML 审计及 3 项直接关联回归，已核对语言页截图。

语言页历史修正：语言选择改用 `location.replace()`，替换当前语言设置记录；一次设置访问无论切换几次语言，返回按钮与浏览器后退均一次回到进入设置前的页面。不同系统页面之间的正常访问仍逐页后退，不新增地址参数、来源存储或历史搜索机制。生产构建 `temp_workspace/public/2609081052-language-history`、HTML 审计及 3 项关联浏览器回归通过，覆盖三语言反复切换、刷新、按钮／浏览器后退、前进到最终语言、文章来源与排序恢复，以及新标签页切换后返回当前语言首页。

选择入口微调：根页面可用顶层 `icon` 声明第一列图标，语言、外观、我的恢复各自已有的 `language`、`theme`、`my` 图标，未声明入口继续使用文件夹。语言和外观页均显式声明 `list: choice`；共享选择模板只负责链接／按钮的原生语义、图标槽、选中样式和 `data-*` 输出，选项来源与操作仍由各自布局和脚本负责。语言选项来自 Hugo `[languages]`，站点在各语言 `params.icon_text` 中声明 `EN`、`简`、`繁`。不建立内容子页、脚本注册器或通用事件总线，也不把选择页并入可排序文章 collection。最终构建为 `temp_workspace/public/2609081501-choice-list-final`；129 页 HTML 审计、导航状态、集合契约、完整 34 项功能回归和 3 项安全回归通过，完整报告分别为 `temp_workspace/regression/260908145441-browser/report.json`、`temp_workspace/regression/260908145659-browser-security/report.json`。将通用图标样式归入基础图标层后，4 项直接关联回归再次通过，报告为 `temp_workspace/regression/260908150234-browser/report.json`。首页只在实际需要时输出排序文案，最终为 19,941 字节、gzip 6,843 字节，原体积门槛未放宽。

选择列表版式对齐：语言、外观的 `h1` 列头已移入 choice 网格，与目录表共用列头高度、间距和横线。共享标题单元格改用 flex 排布，消除文字图标与 SVG 基线不同造成的额外行高；各列表行距随之略微收紧。语言仍按配置 `weight` 排列，外观仍按“跟随系统、浅色、深色”排列，不增加排序箭头、脚本或独立 CSS 文件。最终构建 `temp_workspace/public/2609081521-choice-header-aligned` 的 129 页 HTML 审计和完整 34 项浏览器回归通过，报告为 `temp_workspace/regression/260908152123-browser/report.json`。三语言 × 390／600／1440 宽度的 18 个选择页与目录页逐一对照，列头、横线、前两行坐标一致；截图与测量记录位于 `temp_workspace/choice-header-review/`，已核对明暗主题。第 6 步继续等待用户验收。

5A 实施结果：`assets/js/canvas-position.js` 已改为只传递同标签页的一次列表导航横向位置；记录来源、目标与视觉视口坐标，目标页读取后立即清除，只有来源／目标相符的新访问才使用。普通直接访问不再自动显示主列，刷新与历史恢复继续由浏览器处理。沿用现有 main 列作为原生滚动目标，通过临时滚动留白还原坐标，兼顾桌面布局视口和手机视觉视口，不增加滚动容器或设备模式。用户输入／锚点优先。`grid-products.css` 的名称列已改用共享 `--navigation-column-inline`（15rem）。

5A 验证结果：根内容生产构建及 129 个 HTML 审计通过，现有首屏体积预算未放宽；导航状态检查、34 项功能回归和 3 项 CSP／缓存相关检查通过。新增的桌面／真实触摸回归覆盖产品分类与全部入口、先排序再进入文章、首帧及慢脚本、刷新和前进后退。桌面手动横移 310px、手机触摸横移 305px 后进入 Xvenv，原有列和名称位置保持，正文向右新增；零偏移场景也保持原位。已核对桌面与手机截图，另验证新标签页从画幅起点开始、取消点击不记录位置、存储不可用时正常导航。最终产物为 `temp_workspace/public/2609080057-canvas-stable-final`；功能与安全报告分别位于 `temp_workspace/regression/260908005738-browser/report.json`、`temp_workspace/regression/260908005819-browser-security/report.json`。此后用户已确认并授权 5B／5C；产品结构迁移结果见下文。

5B 的列表展示和 5C 的成员来源属于同一次集合改造，内部依次完成、作为一个可运行结果交付。不要为了单独交付中间状态，再写一个固定产品分类的适配层；所列验证在二者完成后共同执行。本轮已获用户授权，5B／5C 作为一次完整改造交付，等待复测后再进入第 6 步。

1. **5A：画幅位置与名称列宽。** 删除普通新访问强制显示主列的自动定位。沿列点击时，已有列的可见位置保持稳定，新列在右侧出现；同时覆盖用户已手动横移的情况，不能只验证起点为 0。产品表格名称列采用第一列、路径列共用的 15rem 宽度，消除当前 8rem 的独立规则。历史前进／后退和刷新沿用浏览器恢复；锚点、Skip 与键盘焦点仍可按操作定位。若跨文档导航确需记录位置，只记录同标签页该次导航的来源与目标，消费后清除，不建立全局“最后滚动位置”。验证 390、1024、1440 宽度、真实移动模式的 visualViewport 位置、排序后打开 Xvenv 及返回；截图对比已有列坐标。完成后交用户复测。
2. **5B：目录声明列表样式。** 为列表页增加一个 `list` 展示声明，采用 `directory`／`all`／`products` 三个值，分别对应现有的普通目录表、文章明细表和产品表。本页显式声明优先，未声明时继承最近内容祖先；只在列表页消费，普通文章不因继承而变成列表。样式只决定列与排序字段，不能暗中改变成员集合。普通目录使用原目录关系，分类根／分类页使用 Hugo 已提供的分类关系；“全部文章”等汇总入口单独保留其明确的聚合范围。主列表、路径列、来源 JSON 共用同一成员集合与排序规则，一页只注册一次集合；路径列继续显示名称摘要，不复制主表的全部价格／说明字段。同步清除 `/d/` 优先覆盖声明、shortcode 与 front matter 重复定义同一列表、模板按固定路径猜样式的逻辑。产品分类根用普通目录表，子页用产品表；不要为它们再写一种临时列表。用同一目录切换三种样式、子目录覆盖／继承和排序／来源恢复验证。产品样式遇到缺失价格显示 `—`，缺失说明留空，不负责筛选掉页面。
3. **5C：原生产品分类与命名迁移。** 按已确定的 `products`＋`offer` 方案，一次切换配置、内容声明、集合实现、链接和验证。产品分类根为普通分类列表，分类成员使用产品表；产品全部汇总该分类的成员并去重。自动生成的分类页继承 5B 的产品列表配置，不要求逐类创建文件或填写筛选参数。删除四个分类的白名单、价格推导 free／paid、`product.origin` 限定及以存在 `product` 对象判断产品身份的旧逻辑。完成后验证任意新分类、多个分类重复归属、未标价产品、无分类页面和各语言，再交用户验收。

已确认的产品规则：

- 页面具有至少一个有效非空的产品分类值，就进入产品集合；空数组、空字符串不构成收录。正文位置和文章网址不变。
- 分类名由作者自由定义，`free`、`paid`、`first-party`、`$5~$50` 等都是普通词项；不解析含义、不检查互斥、不从价格反推分类。原生 term 的 `.Pages` 提供成员；分类链接使用 `.RelPermalink`，不手拼带特殊字符的词项路径。
- 价格和简短价值说明是可选展示信息，不决定收录。用户已确定统一放在 `offer` 对象内：`offer.amount`、`offer.currency`、`offer.value` 同层，`value` 不成为顶层字段。金额为 0 可显示“免费”；未填写价格显示 `—`，价格升序和降序都将未标价项放末尾，不能按 0 处理。`offer` 可以只填价值说明；填写金额时同时提供币种，不在本轮扩展定价模型。
- 新分类无需实体文件；需要翻译显示名、介绍、排序或显式空分类时才创建对应 `_index.<lang>.md`。保留三种语言的分类根配置，采用普通平面词项、关闭强制 term bundle，并为 `kind: term` 继承列表布局和 breadcrumb。分类成员按各语言页面自己的标注建立。
- 产品全部入口明确聚合哪个分类集合；每个分类页直接使用自身成员，不再引入此前讨论的 `list_source: /d`、`product_filter: free`。

已确定的命名（2026-09-08 用户确认 `products`＋`offer`；代码与内容已迁移）：

| 实体 | 迁移前名称 | 迁移后的名称与含义 |
| --- | --- | --- |
| 产品分类根和文章分类字段 | 根为 `product-categories`，文章分类字段尚未启用 | `products`：根网址 `/products/`，文章填写 `products: [free, first-party]` |
| 全部产品入口 | `products` | `all-products`：网址 `/all-products/`，表示所有已归类产品 |
| 单页展示信息 | `product` | 可选的 `offer` 对象：集中收纳金额、币种、价值说明 |
| 单页价格 | `product.price.amount`、`product.price.currency` | `offer.amount`、`offer.currency`：省去中间的 `price` 层 |
| 单页价值说明 | `product.value` | `offer.value`：简短用途／价值文案，与金额、币种同层 |

产品分类字段确定为 `products`，和 `tags` 一样填写词项数组，名字本身说明分类所属领域。正式配置在现有 `[taxonomies]` 下加入 `product = "products"`，保留 `intent` 和 `tags`。文章通过 `products` 的非空词项数组声明归属，`offer` 对象只承载展示信息。注册配置中的单数键 `product` 是 Hugo 分类声明的一部分，不表示继续保留文章旧的 `product` 对象。

分类根改用 `/products/` 后，原产品全部入口必须移到 `/all-products/`；不能用同一路径同时承担分类根和全部列表。两个入口仍是根层兄弟，显示名称仍为“产品－分类”“产品－全部”。不采用 `/product/` 与 `/products/` 仅靠一个 s 区分两种入口，也不采用失去产品含义的 `/catalog/`。这是为明确的新职责调整旧名称，不因已有网址占用就保留模糊的分类名。`/p/` 已用于文库文章永久链接，文章网址保持原样。

`offer` 表示产品提供的价值与报价，既可用于免费产品，也可用于收费产品。`value` 是“项目级免安装开发环境”这样的用途说明，和 `amount`／`currency` 一同收纳于 `offer`，不放进 `price` 也不拆到根层。现有 `description` 是较长的页面介绍，`offer.value` 是产品表格中的短句，保留这个区别。旧 `product` 对象、其中的 `price` 层与 `origin` 字段一次删除，不并行保留旧声明、顶层 `value` 或 `price.value` 等其他方案。

根项目的 `content/d/products/xvenv/index.zh.md` 已按以下结构迁移（只展示相关字段）：

```yaml
products:
  - free
  - first-party
offer:
  amount: 0
  currency: "$"
  value: "项目级免安装开发环境"
```

具体实现：`collection/config.html` 解析本页或最近祖先的 `list`；`collection/rows.html` 使用目录／分类原生成员或入口的 `aggregate`，主表、路径菜单、来源 JSON 共用结果。`collection/render.html` 按声明绘制三种表格，`products/offer.html` 只读可选展示信息。旧产品筛选器、provider 与路径猜样式、旧 shortcode 及重复渲染器已删除。Xvenv 的三语言标注与四个可选分类内容文件在根项目；主题只保留分类根和汇总入口。

迁移同时更新根项目 `data/redirects.toml`，旧 `/product-categories/.../` 如需保留，应直接转往新 `/products/.../`，避免重定向链。现有规则中 `/products/first-party/`、`/products/third-party/` 及各语言／无尾斜杠变体会与新的真实分类页面重叠，必须按新页面地址删除或重新确定规则，不能机械替换目标造成自跳转。原 `/products/` 改为分类根后不能再重定向到全部入口；原来指向产品全部的站内链接、关于页与测试要明确改为 `/all-products/`。不保留两份内容树或两套分类逻辑，同步核对 canonical、三语言入口、首帧及运行时选中状态。5B 的 `list` 字段和 5C 的原生产品分类均已接入，实体修改说明见 [collection-lists.md](collection-lists.md)。

旧来源边界已确定并验证：文章书签的 `from=product-categories/free` 不再匹配当前来源，`from=products` 也不能继续表示产品全部；两者按原有无效来源规则恢复文章真实目录，第一列选中“目录”。新链接使用 `from=products/free` 和 `from=all-products`。路径重定向只处理旧分类页面网址，不隐式改写文章查询参数；系统页原生后退恢复历史中的原文章网址，再应用同样的有效来源规则，不新增运行时旧名称适配。

本轮计划依据：根项目配置与产品 front matter、主题集合／分类／排序实现，以及前轮针对根内容的 Hugo 分类探针；原生配置约定参考 [Hugo 分类配置](https://gohugo.io/configuration/taxonomies/)。以下实施结果记录本轮验证，不以旧回归替代新要求的验收。

5B／5C 实施结果（2026-09-08）：

- `/products/` 为普通分类表，`/products/<词项>/` 为产品表，`/all-products/` 为分类成员去重后的产品全部。`list` 只负责展示，`aggregate: /d` 与 `aggregate: /products` 只出现在汇总入口。所有列表页只注册一次 collection 来源。
- 名称顺序由 Hugo 计算为数值名次，主表与来源 JSON 共用；浏览器不再对名称按设备语言重新比较，避免同日期、中英文混排条目在首帧后换位。缺失报价双向排最后。
- `check-collections.mjs` 使用临时内容覆盖层，三种视图×三语言验证成员不变、最近祖先继承、覆盖、自动词项、显式空分类、重复归属去重、无分类排除、产品正文保持文章、缺失价格与报价校验；浏览器验证默认顺序与路径列一致，特殊字符词项可以进入文章。
- 根内容最终构建：`temp_workspace/public/2609080123-collections-final`。最终排序修正后完整 34 项功能回归通过（`temp_workspace/regression/260908012453-browser/report.json`）；3 项安全回归通过（`temp_workspace/regression/260908011948-browser-security/report.json`）。导航状态检查与 129 个 HTML 审计通过，首页 20,911 字节、gzip 6,994 字节，未放宽预算。临时集合验证目录为 `temp_workspace/collection-contract-58eZQI`，截图与结构核对在 `temp_workspace/collections-review/`。48 条重定向无自跳转、链路或真实分类页面冲突，文章地址不变。
- 第 6 步配色继续等待本轮用户确认。

以下保留历史实现与验证记录，描述当时状态；其中固定产品分类、自动显示主列、“下一步直接配色”等结论已被上面的 2026-09-08 行动安排替代。

第 2 步后复核：六步顺序仍成立，前两步无需返工。三种语言的实际 Hugo 页面集合均有七个可列出的根入口：`d/`、`intent/`、`tags/`、`all/`、`product-categories/`、`products/`、`site/`；`my/` 已存在但 `build.list: never`，语言与外观页尚未建立。前四个入口的 `weight` 目前均为 0，需要在入口切换时补齐。`fragments/` 等内部节点沿用已有不可列出规则。

后续验收重点：第 4 步验证文章从目录／标签／阅读目的／全部／产品分类进入时，第一列始终完整、选中正确，刷新和前进后退不回写旧菜单；同时从新入口重跑第三步的系统页回归。若修改 `sw-manager.enable.update.js`，仍执行 AGENTS.md 第 9 条规定的缓存及更新验证。第 5 步在 390、1024、1440 宽度验证同一列结构、阅读与返回位置、触摸及键盘可达。第 6 步的黑白灰配色与浅色／深色／跟随系统偏好分别处理。

第 1 步验收：三种语言的站点栏目及九个子页可访问；十五份迁移文件正文一致，原网址、canonical、站点图和图片有效；导航与 HTML 检查、四项既有浏览器回归通过，已核对桌面及窄屏截图。`section-index` 按页面 `weight` 列出直接子页，复用现有列表行；子页的 `build.list: local` 使其在栏目中可列出，同时保持原有全局列表排除行为。

第 1 步排版复核：按用户反馈，将栏目标题改用紧凑的列表列头，并采用现有导航列宽，修正文章标题间距和全宽列表造成的松散布局。第一列仍按第 4 步统一；当前交付用于验收内容归组及站点栏目。

第 2 步结构：`products/` 为产品全部，`product-categories/` 为分类根，其下 `free/`、`paid/`、`first-party/`、`third-party/` 是四个兄弟页面，均由主题提供三种语言。价格分类直接从 `product.price.amount` 推导，来源取 `product.origin`；正文仍在原位置。分类根复用 `section-index`，子页菜单按同一页面顺序生成；普通目录菜单保持静态，产品列表继续使用原集合与排序协议。删除旧产品专用根匹配逻辑，直接按真实根路径匹配。

旧产品分类网址由根项目 `data/redirects.toml` 迁往新地址，不保留旧内容树；导航与关于页改用新入口。`from` 指向当次浏览的集合，已加入 `products-category-entry-lineage` 浏览器回归，覆盖全部／分类进入、选中行、排序、刷新及前进后退。

第 2 步验收：生产模式构建、导航状态检查、123 个 HTML 产物审计通过；五项浏览器回归通过，桌面及窄屏截图已核对。临时挂载的四种价格／来源组合通过三种语言、五个集合的交叉验证，测试数据不进入实际内容或预览产物；三种语言的新页面、canonical、Xvenv 的来源链接、空分类及 24 条重定向规则均已核对。第一列整体展平仍按第 4 步进行。

现有机制说明：[导航状态](navigation-state.md)、[面包屑模型](breadcrumb-models.md)。

第 3 步结构：主题提供 `language/`、`appearance/`、`my/`、`site/` 四个真实根页面，均有三种语言。前三者采用 `build.list: local`，进入 `Home.Pages`，同时保持 `noindex`，不进入全局文章集合、RSS 和站点图。实际 Hugo 集合已验证：首页八个直接子页加两个分类法根，恰好得到十个目标入口。没有增加菜单入口白名单。

第 3 步行为：`assets/js/preferences/` 承担全站语言、外观及设置返回行为；语言页通过 `return` 读取原页面静态译文关系，保留查询参数和锚点，缺失译文时确认后转往目标语言首页，读取失败时允许重试。只接受同源返回地址。原存储键 `preferred_lang`、`theme-preference` 保持有效；外观支持跟随系统、跨页和跨标签页同步，存储不可用时当前页仍可操作。“我的”保留占位说明和原有返回／首页操作，返回优先使用设置来源。

站点页的 `site_update` 是版本文案与更新记录引用的事实源。更新引擎只处理注册、检查、等待和激活；`preferences/site-update-ui.js` 显示状态，旧下拉呈现暂放在 `fragments/nav-utilities/version-menu.js`，明确在第 4 步删除。旧语言、外观独立操作脚本已移除，两种入口共用全站实现。列表组件补齐原生按钮的点击与焦点支持。

第 3 步验收：生产模式构建、导航状态检查、129 个 HTML 审计通过；14 项功能回归与 2 项 CSP／导航预加载检查通过。新增语言返回、外观独立性、站点页更新三个回归，覆盖从文章进入、原来源及排序、刷新、返回、离线重试、新版本提示与激活。补充核对三种语言的 12 个系统页、8 张桌面／窄屏截图、键盘操作和存储受限行为。已验证首次访问的引用资源缓存、离线刷新、旧导航缓存删除、`sw.js` 不入缓存及其响应头；原缓存策略和 SW 模板未修改。移除旧控件后，全站语言推荐和更新确认提示仍有效。

第三步后复核结论：六步顺序保留，前面三步无需因本轮复核返工。第四步的工作量主要来自模板、首帧脚本、运行时和内容声明的一次切换，需要收紧以下边界：

- 根入口按真实父子关系生成；当前十项是结构验证结果，不能写成固定十项白名单，也不把完整入口表重复塞进每个来源集合。直接访问的归属也按内容树判断，不能从 `/p/`、`/about/` 等公开网址前缀猜测。
- 入口列表只有一个 DOM 容器；`renderRootSelection` 当前会重建整份来源菜单，第四步应改成更新统一列表的选中状态。集合内部的兄弟条目、排序与来源信息继续保留；与旧根菜单有关的重复列标记和首帧列数预留同时核对。
- 删除范围须涵盖根项目和主题中的 `nav_primary`、`slots.primary_nav`、`slots.utilities`、`slots.breadcrumb_root` 及失去调用方的模板、脚本和校验。原更新 UI 对旧版本菜单的引用一并移除，新入口承担状态提示，点击仍先进入站点页，再由页内按钮执行更新。该阶段暂留的分类法 `show_in_home`／`home_weight` 已在后续深度清理中随首页快捷列表一起退役。
- 第一列使用共享列表行与列宽；旧页脚的 sticky 顶部偏移按原菜单高度写死，必须在第四步改为随新导航内容正常排布，不能等到第五步或再写一组“十行高度”常量。窄屏在第四步暂沿用现有容器排列，保持同一列表可达，不新增移动菜单；整页横向画幅在第五步完成。
- 首页建议由第一列列头的站点名链接返回，不新增第十一个根入口；保留现有品牌首页内容。菜单入口切换的回归要改走新列表，移除对旧按钮的依赖，继续验证三种语言、系统返回与更新提示。

第四步按以下规则验收第一列选中态，所有场景下入口列表都保持完整：

| 访问方式 | 第一列选中项 |
| --- | --- |
| 从目录、标签、阅读目的或全部文章进入同一文章 | 对应的来源根入口 |
| 从免费、付费、自建或第三方分类进入产品文章 | 产品－分类 |
| 从产品全部进入产品文章 | 产品－全部 |
| 直接打开 Xvenv 的文章网址，无有效 `from` | 目录，正文仍属于 `d/` |
| 直接打开保留旧网址的关于、更新记录或微信页 | 系统－站点，按真实祖先 `site/` 判断 |
| 打开语言、外观、我的或站点页，携带 `return` | 当前系统页，`return` 不参与菜单归属 |
| 首页或没有可列出根祖先的内部页 | 不强行选中某一入口 |

第 4 步结构：`navigation/root-pages.html` 合并首页直接子页与真实分类法根，按页面 weight 排序；第一列只输出一份共享列表，站点名列头返回首页。内容祖先决定直接访问的归属，有效 `from` 决定来源归属；完整入口表不再复制进每份集合数据。同步内联初始化、首帧预览和运行时共用选中函数，慢速外部 JS 加载也不会先高亮默认目录。第一列与路径列使用同一行组件、225px 列宽及选中／悬停样式。页脚随导航自然排列，窄屏仍保持当前上下布局。

第 4 步清理：根项目与主题中的 `nav_primary`、三个旧导航 slot、导航和面包屑覆盖片段、旧控件模板／脚本／样式均已删除。保留 `breadcrumb`、`meta`、`footer` 及业务集合配置；正文目录元信息仍使用完整的真实内容路径。系统链接携带独立 `return`；新版本以站点入口的箭头及本地化说明提示，点击先进入站点页，再由页内按钮检查或应用。

第 4 步验收：生产构建与 129 个 HTML 审计通过；24 项功能回归及 3 项 CSP／导航预加载检查通过。覆盖三语言十入口、来源与直接访问、无效来源、排序、刷新和历史返回、系统偏好及更新。新增五种延迟外部 JS 的首帧断言；修复过程中发现的正文目录信息遗漏与悬停背景叠加均已复测。已核对 390、1024、1440 宽截图，验证首次导航引用资源缓存、离线刷新、旧导航缓存清理及 sw.js 缓存规则。本步完成后等待用户确认，第 5 步再合并横向画幅和滚动恢复。

第四步内部 review（2026-09-07）：根入口、内容祖先、有效来源和 canonical 路径模型无需返工。独立浏览器矩阵覆盖三语言 126 个 index 页面、292 个直接／来源访问场景，选中与路径一致且没有脚本异常。旧导航生产调用已清理；新增第一列的 grid 类不会进入文章排序，排序仅处理显式 data-sortable 集合。

本轮发现的系统链接问题：第三步的返回链接只在普通点击和 pageshow 时更新，页面即时排序后，中键打开／复制设置链接会丢失最新排序。已修正为 URL 状态改变时就同步 href，覆盖主列表排序、路径列排序、hashchange 和 popstate，保持系统页之间的原始 return；主列表排序同时保留已有 history.state。该修正独立于第五步布局，已在本轮 review 完成。

本轮确认的过渡布局问题：390px 站点页中，页脚在 DOM 中位于正文之前，但 CSS order 将其显示在正文之后，Tab 会先到页脚再跳回正文。此项保持为第五步必须解决的已知问题；采用统一列结构后一起清除 order 重排，不为即将删除的上下布局引入另一套 DOM 移动或 tabindex 规则。

第五步的补充实施边界：

- **将路径列变成普通列表**：目前全站 dropdown 的唯一业务调用方是 breadcrumb。统一后删除对应 trigger／caret／hidden 语义、breadcrumb-menu.js 及不再使用的通用 dropdown 资源；保留集合兄弟条目、列头与排序。模板和客户端重绘必须同步切换，不能仅用 CSS 强制展开旧面板。
- **沿用文档画幅**：现有宽屏横向滚动已落在 document.scrollingElement；本轮在 Chromium 验证返回和刷新均能恢复 x=123、y=400。优先复用此路径，不先建立自定义滚动存储系统。整页只有一个横向画幅；表格／代码自身的溢出不应反过来撑宽正文。新访问定位按主内容列的实际可见范围判断，不再新增小／中／大模式。
- **明确定位优先级**：历史返回、前进及刷新保留该次访问位置；新访问有锚点时定位锚点；其余新访问才使当前主内容列进入视野。集合页和系统页也需要纳入，不能只处理文章。排序和异步重绘不能再次触发自动定位；禁止以单个 localStorage 滚动值覆盖不同历史记录。
- **验收行为而非只看截图**：390、1024、1440 宽度下验证当前列可达、长列表／长正文／代码和表格的滚动、DOM 与键盘顺序、skip 链接及锚点；覆盖慢 JS、排序后打开文章再返回，以及浏览器恢复与重新加载两条路径。画幅断点及其加载逻辑统一，首页场景等内容自身的适配单独判断，不机械删除所有媒体查询。第六步仍独立处理黑白灰配色。

本轮修正验收：生产构建、129 个 HTML 审计和导航状态检查通过；新增即时返回链接回归及四项相关既有回归通过。覆盖中键打开、复制前的真实 href、两种即时排序、锚点与历史变化、连续进入系统页及 history.state 保留。未修改缓存策略或更新引擎，未提前实施第五步。

第 5 步结构：所有宽度共用横向列结构，入口和路径列固定 15rem；正文宽度取页面可用宽度与 88ch 的较小值。文档承担整页横向滚动，长代码与表格保留自身滚动。每个路径项直接渲染普通列表，SSR 与浏览器重绘一致；静态列头从真实父级名称和地址生成。删除下拉触发器、面板、控制器、通用 dropdown 资源，以及小／中／大画幅样式；首页场景组件自身的适配保留。页脚在第一列自然排列，不再使用 CSS order 改变显示顺序。

第 5 步定位：头部样式之后的内联初始化只处理新访问；解析到 main 时依据已经占位的路径列和明确的正文宽度，使主内容可见。锚点、已有位置及加载期间的真实用户操作优先；排序、异步来源重绘及视口变化不重复居中。未建立自定义历史滚动存储。新增首屏内联约 1 KB，首页原始 HTML 预算从 20,000 B 调为 21,000 B；gzip 与来源数据预算保持不变，删除的旧脚本与样式不再加载。

第 5 步验收：生产构建、129 个 HTML 审计、导航状态检查、32 项功能回归和 3 项 CSP／缓存相关检查通过。核对 390、1024、1440 宽截图；独立延迟脚本探针覆盖 15 个页面／宽度组合，主列首帧至运行时几何不变。验证来源、静态分类列、排序、系统返回、锚点、Skip、Tab 顺序及慢速流式 HTML 的初始定位与提前输入取消。真实 WSL 文章的代码块和表格在窄屏分别横移 100px／98px，文档坐标不变。Chromium 普通历史重建与启用 BFCache 的真实恢复分别确认 pageshow.persisted=false／true，均恢复 x=123、y=400；刷新与前进也通过回归。测试使用根目录真实内容，未修改缓存策略或更新引擎。

第五步后判断：原有来源及排序协议继续成立，无需追加兼容模式或内容迁移；下一步仍只处理黑白灰配色及清晰的选中／焦点状态。本步完成后等待用户验收，再实施第六步。

移动模式补验：桌面缩窗不等于移动浏览器。真实移动模式会通过 visualViewport 平移展示宽画幅，仅写 document.scrollLeft 不足以定位；已改用一个原生 scrollIntoView 操作，由浏览器选择正确视口，并以 scroll-margin 保留主列留白。无需新的设备模式、滚动容器或缩放限制。正式回归新增 isMobile/hasTouch 场景，使用真实 touchStart/Move/End 验证来回拖动、第一列可达、拖动链接不误激活，以及从系统页返回时恢复用户选定的画幅位置。

移动回归最终验证手动停在视觉坐标 (315,105)，进入系统页再返回可精确恢复；四个系统页的真实触摸操作、缺失译文的原生确认也通过。最终生产产物共 32 项功能回归与 3 项 CSP／缓存相关检查通过。此处移动验证使用 Chromium 移动模式与真实触摸事件，仍需用户在自己的设备上验收手感。
