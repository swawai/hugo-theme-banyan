---
root_nav: true
title: 產品－分類
description: 按價格或來源瀏覽產品。
linkTitle: 產品 - 分類
weight: 40
layout: collection-page
list: directory
list_icon_file: product
outputs:
  - HTML
slots:
  breadcrumb: true
cascade:
  - target:
      kind: term
    layout: collection-page
    list: products
    slots:
      breadcrumb: true
banyan_taxonomy:
  mode: flat
  article_weight: 40
  normalize: identity
  article_mode: all
  require_term_bundles: false
---
