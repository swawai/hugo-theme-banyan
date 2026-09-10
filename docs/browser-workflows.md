# Banyan Browser Workflows

## 结论

日常只需要记 4 种情况：

1. 普通页面 / UI / 样式 / 交互改动
2. `prefetch` / `Speculation-Rules` / CSP 改动
3. SW 升级 / 检查更新页面 / 激活恢复改动
4. 生产候选检查

不要先记一堆脚本名。  
先判断自己改的是哪一类，再直接照抄下面对应的两三条命令。

## 1. 普通页面改动

适用：

- 页面结构
- 样式
- breadcrumb
- 普通前端运行时

命令：

```powershell
bun run build:browser:temp
bun run check:browser:latest-temp
```

## 2. `prefetch` / `Speculation-Rules` / CSP 改动

适用：

- `params.prefetch_runtime`
- `params.speculation_rules`
- `site-prefetch-data`
- `site-prefetch-runtime-meta`
- `Content-Security-Policy`
- `Speculation-Rules` header

命令：

```powershell
bun run build:browser:temp
bun run check:browser:speculation:latest-temp
```

正式配置为 `off` 时，这组命令验证“无 header、无 inline 规则、无孤儿规则文件”。要验证 header 路径，先用仅把 `params.speculation_rules.mode` 覆盖为 `header` 的临时配置构建；完整命令见 [security-csp.md](security-csp.md)。

## 3. SW 升级链路改动

适用：

- `sw.js`
- 更新状态与手动检查
- 激活失败恢复
- 页面内嵌导航数据与更新页面数据交付
- SW 版本升级行为

命令：

```powershell
bun run build:browser:temp -- sw-upgrade-before
# 做出 SW 或更新流程改动
bun run build:browser:temp -- sw-upgrade-after
bun run check:browser:upgrade
```

最关键的判断：

- before / after 本来就是两个不同代码状态
- 不要试图把它脑补成“一次 build 能同时生成两版”

## 4. 生产候选检查

适用：

- 你准备看正式 `public/`
- 想确认不是某个 temp build 的偶然状态

命令：

```powershell
bun run build
bun run check:browser:public
```

如果改的是 `Speculation-Rules` / CSP，也可以接：

```powershell
bun run check:browser:speculation:public
```

部署到线上后，再跑真实响应头验收：

```powershell
bun run check:security:headers
```

这条命令默认检查 `https://swaw.com/`，并确认首页安全头和 `/sw.js` 缓存策略真实生效。

## 什么时候才需要显式指定 build

只有这类情况才需要：

- 你想强制回归去吃某个旧 temp build
- 你想手动指定 upgrade 的 from / to

平时不要先想环境变量。  
先用默认工作流；只有当默认工作流不符合你当前意图时，再去看更底层的 override。

更完整说明见：

- [browser-regression.md](browser-regression.md)
