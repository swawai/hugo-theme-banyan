---
title: "Products"
linkTitle: "Products"
slug: "products"
type: "products"
description: "Curated products marked with product metadata."
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
  - title: "Overview"
    href: "/products/"
    icon: "folder"
    kind: "page"
  - title: "Xvenv"
    href: "/p/xvenv/"
    icon: "file"
    kind: "page"
  - title: "Test"
    href: "/p/test/"
    icon: "file"
    kind: "page"
---

## Product Overview

This intro currently comes from the theme page bundle. Pages marked with `product = true` will be collected in the list below.

{{< fragment path="/fragments/list/page-bundle-note" class="fragment-block" >}}
