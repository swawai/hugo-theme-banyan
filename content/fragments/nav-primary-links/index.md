---
title: Primary Navigation Links Fragment
build:
  list: never
  render: never
slot_resources:
  primary_nav:
    page_css:
      - site-nav.css
      - site-nav.medium.css
      - site-nav.wide.css
nav:
  controls:
    language: false
    theme: false
  me:
    show: false
  items:
    - page: /
      key: home
      text: Swaw
      fallback_when_none: true
    - page: /products
      key: products
      text: Products
    - page: /d
      key: signals
      text: Signals
---
