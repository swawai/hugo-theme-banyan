# Banyan Service Worker Regression Checklist

## 目的

这份 checklist 不是为了证明 “SW 看起来能用”。

它真正要验证的是：

- 新 worker 能否被发现
- waiting -> activate -> reload 这条链是否稳定
- 更新状态是否能在检查更新页面中显示，普通页面是否保持安静
- 隐藏更新控件时，是否仍然保留 waiting 且不弹确认
- 失败恢复是否会误伤正常用户

一个重要心智：

- `sw.js` 是缓存与路由状态机
- `sw-manager` 是浏览器端 orchestration
- UI 提示只是其中一层表象

所以回归时不要只看 “有没弹窗”，而要看：

- worker 状态
- registration.waiting / registration.active
- controller 是否切换
- 缓存是否被正确保留或清理

## 当前关键文件

- `themes/banyan/assets/js/sw.enable.js.tmpl`
- `themes/banyan/assets/js/sw-manager.enable.runtime.js`
- `themes/banyan/assets/js/sw-manager.enable.update.js`
- `themes/banyan/assets/js/updates/ui.js`
- `themes/banyan/assets/js/updates/page.js`
- `themes/banyan/assets/js/sw-manager.disable.js`
- `themes/banyan/assets/js/runtime-manifest.js`
- `themes/banyan/layouts/baseof.html`

## 当前实现的关键约定

### SW enable 模式

- `sw.js` 由 `sw.enable.js.tmpl` 生成
- 浏览器侧 manager 由 `sw-manager.enable.entry.js.tmpl` 打包进入 `sw-manager.enable.bundle.*.js`
- registration 使用：
  - `scope: /`
  - `updateViaCache: 'none'`

### 更新提示界面

- 检查更新子页面 `/updates/check/` 使用 `data-site-update-panel` 显示版本、检查按钮和状态；共用更新引擎
- 只有检查页加载 `updates/page.js` 和 UI 文案逻辑。全站引擎通过 `BanyanServiceWorkerManagerRuntime.updates.subscribe()` 提供状态，页面用 `check()` 请求检查／应用；引擎不再导入 UI
- 普通页面没有 `html[data-site-update]` 镜像状态；测试通过 `registration.waiting` 判断待更新，检查页通过 `data-site-update-state` 验证显示
- 更新目录 `/updates/` 使用名称列表显示两个真实子项，第一列没有 `data-site-update-link` 或专用更新标记
- 第一列通过普通更新入口进入名称列表，再进入检查更新页；点击入口不会检查或应用更新
- 旧 Ver 下拉菜单及脚本已移除
- 当前逻辑应当：
  - 普通页面静默发现更新，不弹确认、不因发现更新主动重载
  - 用户通过更新入口及其子项进入检查更新页，worker 仍处于 waiting
  - 检查页按钮检查更新，ready 时显示“立即更新”并负责应用更新；目录和路径列不承担更新动作
  - 已有 waiting worker 时用户主动刷新页面，继续沿用现有应用更新逻辑

### 语言文案

- 版本界面文案的事实源为 `content/updates/check/index*.md` 的 `site_update.labels`，由同一 partial 提供给静态界面和 runtime JSON；不再定义弹窗文案
- 语言 fallback 依赖 `runtime/asset-manifest.json` 内的 `i18nFallbacks`
- 只有更新页 UI 使用 `runtime-manifest.js` 获取版本与文案；语言选项和返回独立使用页面内静态译文关系，不依赖 runtime JSON

### 激活失败恢复

- 若 waiting worker 被请求 `SKIP_WAITING` 后，4 秒内没有完成切换：
  - manager 会尝试恢复
  - 最重的路径是：`unregister + clearManagedCaches + reload`

这条路径非常敏感，所以它是回归重点。

## 回归前准备

### 建议环境

- 一个真实浏览器 profile
- DevTools 可打开 `Application > Service Workers` 与 `Application > Cache Storage`
- 最好准备两份连续构建产物

### 建议构建方式

先生成一版旧产物，再生成一版新产物。

例子：

```powershell
bun run build:browser:temp -- sw-upgrade-before
bun run build:browser:temp -- sw-upgrade-after
```

如果要做真实升级链，应该让浏览器先跑 `build-a`，再切换到 `build-b`。

### 建议观察面板

- `Application > Service Workers`
- `Application > Cache Storage`
- `Network`
- `Console`

## 基础 smoke checks

### 1. 首次访问注册

操作：

1. 清空当前站点 service worker 与相关缓存
2. 打开首页
3. 等待页面稳定

预期：

- 存在 root scope 的 service worker registration
- `registration.active` 存在
- 没有 `waiting` worker
- 页面无异常 reload 循环

失败信号：

- 注册根本没建立
- 刚首次访问就出现 waiting / ready 提示
- 控制台出现明显 registration/fetch 错误

### 2. 关键缓存建立

操作：

1. 首次访问首页
2. 再进入一个 breadcrumb 页，如：
   - `/p/xvenv/`
   - `/d/products/`
3. 查看 Cache Storage

预期：

- 存在当前 build 对应的 `nav-html-*`
- 存在当前 build 对应的 `asset-versioned-*`
- 存在 `asset-fingerprint`
- 首次导航会预缓存当前 HTML 引用的样式与脚本资源
- 导航使用 cache-first + versioned，带 hash 资源使用 cache-first + fingerprinted；`sw.js` 不进入缓存
- `/sw.js` 响应为 `Cache-Control: no-cache, max-age=0, must-revalidate`

失败信号：

- 只注册了 worker，但没有建立任何受管缓存
- 缓存桶命名异常
- 首次导航后缓存仍为空

## 更新链路 checks

### 3. 新版本可被发现

操作：

1. 浏览器先加载旧版本
2. 切到新版本产物
3. 触发一次刷新，或等待定时检查
4. 必要时切后台再切回前台，触发 visibility update check

预期：

- 新 worker 被发现
- `registration.waiting` 最终出现
- 页面进入 `data-site-update="ready"`

失败信号：

- 新 build 已部署，但浏览器长时间没有 waiting worker
- `registration.update()` 后仍停留旧 worker 且无错误线索

### 4. 通过更新入口检查和应用新版本

建议页面：

- `/`
- `/all/`
- `/d/`
- `/p/xvenv/?from=tags/tooling/devtools/windows`

操作：

1. 让页面进入 update ready 状态
2. 点击第一列「更新」，再点击「检查更新」子项

预期：

- 普通页面没有弹窗或自动重载，更新等待用户在检查页应用
- 第一列是普通更新入口，无特殊更新标记；名称列表仅含两个真实子项
- 进入检查页后保留更新列表列及其选中项，worker 仍然 waiting，直到点击「立即更新」
- 可见检查按钮所在页面直接呈现状态，应用后重载并保留当前页和路径列

失败信号：

- 点击普通入口或子项就应用更新
- 检查页丢失更新路径列或正确选中项
- breadcrumb 当前项带有更新动作
- 任意页面出现自动更新确认框

### 5. 隐藏更新控件时仍保持安静

建议页面：

- 临时隐藏检查更新按钮，且页面没有其他可见更新控件的场景
- offline 页面不属于这个场景，因为它不注入 enable manager

操作：

1. 让页面进入 update ready 状态
2. 再次检查更新，观察页面和 waiting worker

预期：

- 控件隐藏不会触发弹窗或自动应用
- waiting worker 保持可用；重新显示控件后可手动应用

失败信号：

- 出现 `window.confirm`
- 因控件隐藏而自动应用或丢失 waiting worker

### 6. 激活成功链

操作：

1. 在检查页 ready 状态下点击“立即更新”
2. 观察 worker 状态与页面刷新

预期：

- waiting worker 收到 `SKIP_WAITING`
- 浏览器触发 `controllerchange`
- 页面刷新一次
- 刷新后使用的是新 active worker
- `data-site-update="ready"` 被清掉

失败信号：

- waiting 一直不消失
- controller 没切换
- 页面刷新多次形成循环
- 刷新后仍是旧 worker

### 7. 激活超时恢复链

这是高风险专项，不需要每次都测，但改过 `sw-manager` 激活逻辑后建议测。

操作思路：

1. 制造一个“waiting worker 切换非常慢或卡住”的场景
2. 在检查页点击“立即更新”
3. 观察 4 秒 fallback

预期：

- 真卡住时，最终会走恢复路径
- 恢复后页面能重新加载，不留脏状态

重点观察：

- registration 是否被注销
- 受管缓存是否被清掉
- reload 后是否能重新注册

失败信号：

- 误把慢激活当卡死
- 正常用户频繁触发硬恢复
- 恢复后进入 reload loop

## 语言与文案 checks

### 8. runtime i18n 文案加载

建议语言：

- `en`
- `zh`
- `zh-tw`

操作：

1. 分别让页面进入 update ready
2. 查看检查更新页面中的状态和按钮文案

预期：

- 状态和按钮文案来自对应语言的 runtime i18n
- 版本界面的字段来自检查页 `site_update.labels`

失败信号：

- 某语言退回英文但其实有本地化资源
- 版本界面没有读到检查页文案

### 9. fallback 语言链

重点语言：

- `zh-hk`
- `zh-mo`

操作：

1. 让页面语言环境命中 `zh-hk` 或 `zh-mo`
2. 在检查页触发更新状态变化

预期：

- 会按 `runtime/asset-manifest.json` 的 `i18nFallbacks` 落到 `zh-tw`

失败信号：

- 仍然退回英文
- 检查页更新状态仍使用英文，未解析 runtime i18n 的回退关系

## 关闭模式 checks

### 10. disable 模式清理

操作：

1. 先在 enable 模式下建立 registration 与缓存
2. 切到 disable 模式产物
3. 重新访问页面

预期：

- root scope registration 被注销
- 受管缓存被清理
- 页面不再重新注册 enable worker

失败信号：

- disable 页面仍残留旧 registration
- managed caches 没被删干净
- disable 后刷新又莫名回到 enable 行为

## 建议的最小回归矩阵

如果不想每次都全测，至少覆盖这 6 组：

1. 首页首次访问
2. 首页与集合页面出现 waiting 后，通过第一列「更新」进入更新目录，再打开检查页应用更新（`sw-update-entry-home`、`sw-update-entry-collection`）
3. `zh-hk` 与 `zh-mo` 的入口状态文案 fallback（`sw-update-entry-zh-hk`、`sw-update-entry-zh-mo`）
4. 隐藏检查按钮后仍不弹窗，重复检查继续保留 waiting（`sw-update-hidden-control-stays-quiet`）
5. 检查更新页离线重试、检查新版本、激活刷新及旧导航缓存清理（`sw-update-check`）
6. 新版本 waiting 时，语言设置页仍然可以使用

运行升级回归时，显式设置 `BANYAN_BROWSER_UPGRADE_FROM_DIR` 和 `BANYAN_BROWSER_UPGRADE_TO_DIR`，指向两个完整构建；此矩阵需要两份都包含展平后的第一列和系统页。不要让自动选择误用临时结构探针的产物。

## 出问题时先怀疑哪一层

### 看不到更新提示

优先怀疑：

1. 新 worker 根本没进入 `waiting`
2. `data-site-update="ready"` 没被设置
3. 是否已经进入检查更新页；普通页面不显示提示
4. 检查页的 `data-site-update-state` 或状态文字未更新

### 文案语言不对

优先怀疑：

1. `runtime/asset-manifest.json` 的 `i18n` / `i18nFallbacks`
2. `runtime-manifest.js`
3. 当前页 `document.documentElement.lang`

### 点击更新后卡住

优先怀疑：

1. `registration.waiting` 是否真的存在
2. `SKIP_WAITING` 是否发到正确 worker
3. `controllerchange` 是否触发
4. 4 秒 fallback 是否误判

### 关闭 SW 后仍残留旧行为

优先怀疑：

1. `sw-manager.disable.js`
2. root scope registration 是否被正确识别
3. managed caches 名称前缀是否与 enable 模式一致

## 当前已知敏感点

### 更新入口与操作分开

第一列「更新」与其他目录入口相同，不承担更新标记。检查、应用更新由真实子页「检查更新」中的按钮执行；其他 breadcrumb 列和当前菜单选项不带更新动作。普通页面和隐藏控件的页面均不再弹确认框。

### 4 秒激活超时

`SW_ACTIVATION_TIMEOUT_MS = 4000` 现在是经验值，不是协议事实。  
如果未来真机上出现误恢复，应优先重新评估这个阈值，而不是先打补丁改 UI。

### disable 模式是 destructive 的

`sw-manager.disable.js` 会：

- `unregister`
- `clearManagedCaches`

所以测试 disable 模式时，不要和普通前端 UI 回归混在一起。
