---
title: Primary Navigation Links Fragment
build:
  list: never
  render: never
slot_resources:
  primary_nav:
    page_css:
      - site-nav.css
nav:
  controls:
    language: false
    theme: false
  me:
    show: false
  items:
    - page: /
      key: home
      text: 人不工
      fallback_when_none: true
    - page: /products
      key: products
      text: 產品
    - page: /d
      key: signals
      text: 信號
---
