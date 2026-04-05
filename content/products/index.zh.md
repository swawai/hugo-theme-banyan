---
title: 产品
linkTitle: 产品
description: 所有标记为产品的内容会汇总在这里。
slug: "products"
layout: "article"
show_breadcrumb: false
show_meta: false
---

# 产品

这是一个 leaf bundle 页面。

现在它的介绍文案、说明段落，以及列表放在页面里的具体位置，都由这个 bundle 页面自己控制。

{{< products-list >}}

后续你只需要在这份 Markdown 里移动这个 shortcode，产品列表就会跟着移动到对应位置。

别的 bundle 页面如果也想嵌入这份列表，可以写 `{{</* products-list */>}}`。
