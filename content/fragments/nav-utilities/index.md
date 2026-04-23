---
title: Navigation Utilities Fragment
build:
  list: never
  render: never
slot_resources:
  utilities:
    page_css:
      - site-nav.css
      - site-nav.medium.css
      - site-nav.wide.css
      - nav-utilities.css
    page_js:
      - nav-utilities.js
nav:
  labels:
    language: Language
    theme: Theme
    theme_auto: Auto
    theme_light: Light
    theme_dark: Dark
    me: Me
  controls:
    language: true
    theme: true
  me:
    show: true
    page: /me
    key: me
---
