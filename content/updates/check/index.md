---
title: Check for updates
description: View the current site version and check for updates.
type: page
date: 2026-09-08
slug: check
layout: update-check
icon: { text: "↻" }
weight: 10
outputs:
  - HTML
robots: noindex, follow
build:
  list: local
slots:
  breadcrumb: true
site_update:
  labels:
    current_version: Current version
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
