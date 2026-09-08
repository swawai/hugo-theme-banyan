---
title: 產品－分類
description: 按價格或來源瀏覽產品。
weight: 50
layout: article-list
list: directory
list_icon_file: product
outputs:
  - HTML
slots:
  breadcrumb: true
cascade:
  - _target:
      kind: term
    layout: article-list
    list: products
    slots:
      breadcrumb: true
banyan_taxonomy:
  mode: flat
  show_in_home: false
  home_weight: 50
  article_weight: 40
  normalize: identity
  article_mode: all
  require_term_bundles: false
---
