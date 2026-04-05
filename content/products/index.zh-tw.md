---
title: 產品
linkTitle: 產品
description: 所有標記為產品的內容都會彙整在這裡。
slug: "products"
layout: "article"
show_breadcrumb: false
show_meta: false
---

# 產品

這是一個 leaf bundle 頁面。

現在它的介紹文案、說明段落，以及列表放在頁面裡的具體位置，都由這個 bundle 頁面自己控制。

{{< products-list >}}

後續你只需要在這份 Markdown 裡移動這個 shortcode，產品列表就會跟著移動到對應位置。

別的 bundle 頁面如果也想嵌入這份列表，可以寫 `{{</* products-list */>}}`。
