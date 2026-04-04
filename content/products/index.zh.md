---
title: "产品"
linkTitle: "产品"
slug: "products"
type: "products"
description: "所有标记为产品的内容会汇总在这里。"
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
  - title: "产品总览"
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

## 产品总览

这段说明当前来自主题内的 page bundle。凡是标记了 `product = true` 的页面，都会汇总在下面的列表中。

{{< fragment path="/fragments/list/page-bundle-note" class="fragment-block" >}}
