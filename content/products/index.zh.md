---
title: 产品
linkTitle: 产品
description: 所有标记为产品的内容会汇总在这里。
slug: "products"
layout: "article"
collection:
  view: "flat"
  variant: "products"
  item_builder: "products"
  default_sort: "name-asc"
  empty_label: "暂无产品内容。"
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

# 产品

这是一个 branch bundle 集合页。

现在它的介绍文案、说明段落，以及列表放在页面里的具体位置，都可以由这个 bundle 自己控制，而不必完全写死在 layout 里。

{{< collection-list >}}

后续你只需要在这份 Markdown 里移动这个 shortcode，产品列表就会跟着移动到对应位置。

别的 bundle 页面如果也想嵌入这份列表，可以写 `{{</* collection-list page="/products" */>}}`。
