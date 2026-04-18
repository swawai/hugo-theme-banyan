---
title: Products Breadcrumb Fragment
build:
  list: never
  render: never
breadcrumb:
  variant: lead-menu
  auto_tail: current
  menu_mode: current-root
  menu_label: Product categories
  lead:
    text: ALL
    page: /products
    menu_label: Open product categories
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
