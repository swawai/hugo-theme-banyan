---
title: Products - Categories
description: Browse products by price or origin.
weight: 50
layout: article-list
list: directory
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
