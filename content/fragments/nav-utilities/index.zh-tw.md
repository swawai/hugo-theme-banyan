---
title: Navigation Utilities Fragment
build:
  list: never
  render: never
slot_resources:
  utilities:
    page_css:
      - site-nav.css
      - nav-utilities.css
    page_js:
      - nav-utilities.js
nav:
  labels:
    language: 語言
    theme: 主題
    theme_auto: 自動
    theme_light: 亮色
    theme_dark: 深色
    me: 我
  controls:
    language: true
    theme: true
  me:
    show: true
    page: /me
    key: me
---
