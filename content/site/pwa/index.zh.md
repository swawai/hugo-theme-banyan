---
title: PWA 状态
description: 查看当前站点版本并检查更新。
type: page
date: 2026-09-08
slug: pwa
layout: pwa-page
outputs:
  - HTML
robots: noindex, follow
build:
  list: local
slots:
  breadcrumb: true
site_update:
  changelog_page: /site/changelog
  labels:
    check: 检查更新
    checking: 检查中...
    check_failed: 检查失败
    unavailable: 当前环境无法检查更新
    status: 状态
    status_current: 已是最新
    status_ready: 有新版本
    status_offline: 离线
    status_click_update: 立即更新
    status_click_retry: 点击重试
---

检查是否有新的站点版本。更新准备好后，点击“立即更新”应用新版本并重新载入当前页面。
