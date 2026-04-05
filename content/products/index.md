---
title: Products
linkTitle: PRODUCTS
description: Curated products marked with product metadata.
slug: "products"
layout: "article"
collection:
  view: "flat"
  variant: "products"
  item_builder: "products"
  default_sort: "name-asc"
  empty_label: "No products yet."
  columns:
    - key: "name"
      class: "cell-title"
      cell: "title"
      label_i18n: "products_col_name"
      default_order: "asc"
      title_asc_i18n: "products_sort_name_asc"
      title_desc_i18n: "products_sort_name_desc"
    - key: "price"
      class: "cell-price"
      cell: "text"
      label_i18n: "products_col_price"
      default_order: "desc"
      title_asc_i18n: "products_sort_price_asc"
      title_desc_i18n: "products_sort_price_desc"
    - key: "value"
      class: "cell-value"
      cell: "text"
      label_i18n: "products_col_value"
      default_order: "asc"
      title_asc_i18n: "products_sort_value_asc"
      title_desc_i18n: "products_sort_value_desc"
---

# Products

This page is a branch bundle collection page.

The introduction, explanation text, and list placement can now be controlled by this bundle itself instead of being fully fixed in layout.

{{< collection-list >}}

You can move the shortcode anywhere in this Markdown body, and the product list will follow that position.

Other bundle pages can also embed this list with `{{</* collection-list page="/products" */>}}`.
