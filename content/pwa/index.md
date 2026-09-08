---
root_nav: true
title: PWA Status
description: View the current site version and check for updates.
type: page
date: 2026-09-08
slug: pwa
layout: pwa-page
icon: { text: "↻" }
weight: 96
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
    check: Check for updates
    checking: Checking...
    check_failed: Check failed
    unavailable: Updates are unavailable in this browser.
    status: Status
    status_current: Up to date
    status_ready: New version available
    status_offline: Offline
    status_click_update: Update now
    status_click_retry: click retry
---

Check for a newer site version. When an update is ready, choose **Update now** to apply it and reload this page.
