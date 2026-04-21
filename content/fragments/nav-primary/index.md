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
    language: Language
    theme: Theme
    theme_auto: Auto
    theme_light: Light
    theme_dark: Dark
    me: Me
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
  controls:
    language: true
    theme: true
  me:
    show: true
    page: /me
    key: me
---
