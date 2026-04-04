---
title: "產品"
linkTitle: "產品"
slug: "products"
type: "products"
description: "所有標記為產品的內容都會彙整在這裡。"
page_css:
  - page.css
outputs:
  - html
nav_id: "products"
nav_slot: "primary"
nav_weight: 2
nav_menu_id: "products"
render_main: "products-list"
render_styles_variant: "products"
render_workspace: "products"
render_mode: "productsbynameasc"
desktop_children:
  - title: "產品總覽"
    href: "/products/"
    icon: "folder"
    kind: "page"
  - title: "Xvenv"
    href: "/p/xvenv/"
    icon: "file"
    kind: "page"
  - title: "test"
    href: "/p/test/"
    icon: "file"
    kind: "page"
---

## 產品總覽

這段說明目前來自主題內的 page bundle。凡是標記了 `product = true` 的頁面，都會彙整在下面的列表中。

{{< fragment path="/fragments/list/page-bundle-note" class="fragment-block" >}}
