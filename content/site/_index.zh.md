---
title: 系统－站点
description: 站点介绍、更新记录与联系入口。
layout: article-list
list: directory
weight: 100
outputs:
  - HTML
slots:
  breadcrumb: true
  footer: /fragments/home-footer-shortcuts
cascade:
  slots:
    breadcrumb: true
site_update:
  changelog_page: /site/changelog
  labels:
    check: 立即检查
    checking: 检查中...
    check_failed: 检查失败
    unavailable: 当前环境无法检查更新
    status: 状态
    status_current: 已是最新
    status_ready: 有新版本
    status_offline: 离线
    status_click_update: 点击更新
    status_click_retry: 点击重试
---
