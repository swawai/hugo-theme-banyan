---
title: Products Breadcrumb Model
build:
  list: never
  render: never
breadcrumb:
  variant: lead-menu
  auto_tail: full
  menu_mode: current-root
  menu_label: Product categories
  lead:
    page: /products
    menu_label: Open product categories
  menu_sources:
    - source: section-children
      page: /products
      include_self: true
---
