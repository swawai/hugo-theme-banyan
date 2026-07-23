---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
# The theme renders the sole article H1 from title; start body headings at ##.
# Optional concise noun phrase for navigation, lists, and breadcrumbs:
# linkTitle: ""
date: {{ .Date }}
draft: true
slug: "{{ .File.ContentBaseName }}"
description: ""

# Agent-friendly Markdown mirror:
# - AGENT_MARKDOWN: generate /index.md, advertise it in HTML, and list it in llms.txt.
# - MARKDOWN: generate /index.md only.
# Keep HTML first. Hugo uses output order for the primary output; Markdown first
# can make list/taxonomy links treat index.md as the page URL.
# outputs:
# - HTML
# - AGENT_MARKDOWN

#intent:
#- explore
#tags: []
---
