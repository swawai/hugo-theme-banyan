---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
slug: "{{ .File.ContentBaseName }}"

# 别名，用于向后兼容，例如更换 slug 时保留旧链接不会 404
# aliases:
# - /old-url-path/

# 标签 (支持层级结构，例如: 父标签/子标签)
# tags:
# - tag1
# - tag1/subtag

# 国际十进分类法(UDC)分类号
# udc:
# - "100"
# - "100/110"
---

