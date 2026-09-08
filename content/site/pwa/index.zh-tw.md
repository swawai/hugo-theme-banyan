---
title: PWA 狀態
description: 查看目前站點版本並檢查更新。
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
    check: 檢查更新
    checking: 檢查中...
    check_failed: 檢查失敗
    unavailable: 目前環境無法檢查更新
    status: 狀態
    status_current: 已是最新
    status_ready: 有新版本
    status_offline: 離線
    status_click_update: 立即更新
    status_click_retry: 點擊重試
---

檢查是否有新的站點版本。更新準備好後，點擊「立即更新」套用新版本並重新載入目前頁面。
