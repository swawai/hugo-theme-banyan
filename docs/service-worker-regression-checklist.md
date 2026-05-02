# Banyan Service Worker Regression Checklist

## 目的

这份 checklist 不是为了证明 “SW 看起来能用”。

它真正要验证的是：

- 新 worker 能否被发现
- waiting -> activate -> reload 这条链是否稳定
- 更新提示是否挂在正确的 breadcrumb 锚点上
- 没有可用锚点时，是否正确退化到 `confirm`
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
- `themes/banyan/assets/js/sw-manager.disable.js`
- `themes/banyan/assets/js/runtime-manifest.js`
- `themes/banyan/layouts/_default/baseof.html`

## 当前实现的关键约定

### SW enable 模式

- `sw.js` 由 `sw.enable.js.tmpl` 生成
- 浏览器侧 manager 由 `sw-manager.enable.entry.js.tmpl` 打包进入 `sw-manager.enable.bundle.*.js`
- registration 使用：
  - `scope: /`
  - `updateViaCache: 'none'`

### 更新提示锚点

- 当前更新提示优先挂到 `data-site-update-anchor`
- 这个锚点可能不止一个
- 当前逻辑应当：
  - fallback 检查时，找任意一个“可用锚点”
  - 点击时，认用户实际点击的那个锚点

### 语言文案

- 更新提示文案来自 runtime i18n JSON
- 语言 fallback 依赖 `runtime/asset-manifest.json` 内的 `i18nFallbacks`
- `language-menu` 与 `sw-manager` 现在共用同一条 `runtime-manifest.js` 主路径

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
.\node_modules\.bin\hugo.cmd --gc --minify --destination temp_workspace/public/<build-a>
.\node_modules\.bin\hugo.cmd --gc --minify --destination temp_workspace/public/<build-b>
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

### 4. 有 breadcrumb 锚点时的更新提示

建议页面：

- `/all/`
- `/d/`
- `/p/xvenv/?from=tags/tooling/devtools/windows/xvenv&sorts=date-desc,date-desc,date-desc,date-desc`

操作：

1. 让页面进入 update ready 状态
2. 点击一个可见的 breadcrumb 当前项更新锚点

预期：

- 点击该锚点会出现 update popover
- 不会错误退化为 `window.confirm`
- 如果同页有多个锚点，点击任意一个可见当前锚点都应生效

失败信号：

- 页面上明明有更新高亮锚点，但点击无反应
- 只有某一个锚点能点，其他可见锚点失效
- 可见锚点存在，但仍直接弹 `confirm`

### 5. 无可用锚点时的 fallback

建议页面：

- 首页 `/`
- 或临时让当前页没有可见 breadcrumb current link 的场景

操作：

1. 让页面进入 update ready 状态
2. 观察是否退化到 `window.confirm`

预期：

- 没有可用锚点时，fallback confirm 会出现
- 点击确认后，会继续走 waiting worker 应用链

失败信号：

- 无锚点也无任何提示
- fallback 连续反复弹出
- fallback 出现后不能真正进入激活链

### 6. 激活成功链

操作：

1. 在 ready 状态下确认更新
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
2. 触发更新确认
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
2. 打开 popover 或 fallback confirm

预期：

- 文案来自对应语言的 runtime i18n
- 三个字段都正确：
  - `site_update_prompt`
  - `site_update_confirm`
  - `site_update_later`

失败信号：

- 某语言退回英文但其实有本地化资源
- 三个字段只部分本地化

### 9. fallback 语言链

重点语言：

- `zh-hk`
- `zh-mo`

操作：

1. 让页面语言环境命中 `zh-hk` 或 `zh-mo`
2. 触发更新提示

预期：

- 会按 `runtime/asset-manifest.json` 的 `i18nFallbacks` 落到 `zh-tw`

失败信号：

- 仍然退回英文
- `language-menu` 和 `sw-manager` 对同一语言的 fallback 行为不一致

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

如果不想每次都全测，至少覆盖这 4 组：

1. 首页首次访问
2. breadcrumb 页面出现 waiting 后，点击更新锚点
3. 无锚点页面的 fallback confirm
4. `zh-hk` 或 `zh-mo` 的文案 fallback

## 出问题时先怀疑哪一层

### 看不到更新提示

优先怀疑：

1. 新 worker 根本没进入 `waiting`
2. `data-site-update="ready"` 没被设置
3. 当前页没有可用锚点
4. 锚点存在但点击命中的不是可用 anchor

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

### 多锚点页面

当前页面可能同时生成多个 `data-site-update-anchor`，例如：

- rail root current
- stage root current
- menu panel current option

所以不要再假设“更新锚点只有一个”。

### 4 秒激活超时

`SW_ACTIVATION_TIMEOUT_MS = 4000` 现在是经验值，不是协议事实。  
如果未来真机上出现误恢复，应优先重新评估这个阈值，而不是先打补丁改 UI。

### disable 模式是 destructive 的

`sw-manager.disable.js` 会：

- `unregister`
- `clearManagedCaches`

所以测试 disable 模式时，不要和普通前端 UI 回归混在一起。
