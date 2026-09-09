---
root_nav: true
title: Products - Categories
description: Browse products by price or origin.
linkTitle: Products - Categories
weight: 40
layout: article-list
list: directory
list_icon_file: product
outputs:
  - HTML
slots:
  breadcrumb: true
cascade:
  - target:
      kind: term
    layout: article-list
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
