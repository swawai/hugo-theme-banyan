---
title: 产品面包屑片段
build:
  list: never
  render: never
breadcrumb:
  variant: lead-menu
  auto_tail: current
  menu_mode: current-root
  menu_label: 产品分类
  lead:
    text: ALL
    page: /products
    menu_label: 展开产品分类
  menu:
    - text: ALL
      page: /products
    - text: Paid
      page: /products-paid
    - text: Free
      page: /products-free
    - text: third-party
      page: /products-third-party
---
