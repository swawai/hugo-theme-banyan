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
    - href: /
      text_key: label_home
    - href: /products/
      text: Products
    - href: /d/
      text: Signals
  controls:
    language: true
    theme: true
  me:
    show: true
---
