---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
# The theme renders the sole article H1 from title; start body headings at ##.
# Optional concise noun phrase for navigation, lists, and breadcrumbs:
# linkTitle: ""
date: {{ .Date }}
draft: true
slug: "{{ .File.ContentBaseName }}"
description: ""

# Optional links to copies published on other platforms. GitHub is automatic.
# published_links:
# - label: WeChat
#   url: https://example.com/article

#intent:
#- explore
#tags: []
---
