---
root_nav: true
title: 产品－分类
description: 按价格或来源浏览产品。
linkTitle: 产品 - 分类
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
