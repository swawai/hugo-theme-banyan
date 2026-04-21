---
title: Primary Navigation Fragment
build:
  list: never
  render: never
page_css:
  - nav-primary.css
page_js:
  - nav-primary.js
nav:
  labels:
    language: 语言
    theme: 主题
    theme_auto: 自动
    theme_light: 明亮
    theme_dark: 深色
    me: 我
  items:
    - page: /
      key: home
      text: 人不工
      fallback_when_none: true
    - page: /products
      key: products
      text: 产品
    - page: /d
      key: signals
      text: 信号
  controls:
    language: true
    theme: true
  me:
    show: true
    page: /me
    key: me
---
