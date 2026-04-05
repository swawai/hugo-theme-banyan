---
title: 產品
linkTitle: 產品
description: 所有標記為產品的內容都會彙整在這裡。
slug: "products"
layout: "article"
collection:
  view: "flat"
  variant: "products"
  item_builder: "products"
  default_sort: "name-asc"
  empty_label: "暫無產品內容。"
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

# 產品

這是一個 branch bundle 集合頁。

現在它的介紹文案、說明段落，以及列表放在頁面裡的具體位置，都可以由這個 bundle 自己控制，而不必完全寫死在 layout 裡。

{{< collection-list >}}

後續你只需要在這份 Markdown 裡移動這個 shortcode，產品列表就會跟著移動到對應位置。

別的 bundle 頁面如果也想嵌入這份列表，可以寫 `{{</* collection-list page="/products" */>}}`。
