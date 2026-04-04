# Page Bundle Contract

This theme keeps page shell, shared styles, SEO, schema, prefetch, and service worker logic inside `layouts/` and shared `assets/`.

Page-specific copy and page-specific assets should live inside a content bundle.

## Scope

- Use `content/_index.md` for home.
- Use `content/<section>/_index.md` for section pages.
- Use `content/<page>/index.md` for single pages.

When a home or section `_index.md` contains body content, the theme renders that content above the list/grid view.

This contract currently covers single-page bundle assets declared in front matter.

## Supported Front Matter

```yaml
page_inline_css:
  - page.inline.css
page_primary_inline_css:
  - page.css
page_css:
  - page.css
page_js:
  - page.js
```

## Rules

- `page_css` and `page_js` only resolve resources from the current page bundle.
- `page_inline_css` also resolves resources from the current page bundle and inlines processed CSS into the page head.
- `page_primary_inline_css` resolves resources from the current page bundle, inlines processed CSS on the page's primary output, and emits a normal stylesheet link on non-primary outputs.
- Each declared file must exist in the same bundle, or Hugo fails the build.
- Theme shared base styles and shared runtime scripts stay in theme assets; bundle assets are additive.
- Bundle JS should stay static. If it needs page-specific URLs or state, expose them from layout markup or `data-*` attributes instead of writing Hugo template syntax inside `page.js`.
- `page_inline_css` is for self-contained pages where an extra stylesheet request is undesirable, such as offline fallbacks.
- On home or section bundles with multiple output formats, prefer `page_primary_inline_css` when only the primary public URL should inline page-local CSS. Use `page_css` when every output should stay external, and `page_inline_css` only when every output should inline the CSS.
- If the same file is declared in both `page_primary_inline_css` and `page_css`, the primary-inline rule wins and the plain `page_css` emission skips that duplicate entry.
- Authors should not hand-write `<link rel="stylesheet">` or external `<script src>` tags for page-local assets inside Markdown content.
- Authors can still use normal Markdown and HTML for body content, images, downloads, and inline embeds.

## Output Behavior

- Bundle CSS is published under `/css/page/`.
- Bundle JS is published under `/js/page/`.
- Inline CSS declared by `page_inline_css` is processed and embedded into the final HTML instead of being published as a standalone file.
- CSS declared by `page_primary_inline_css` is embedded only on the page's primary output; other outputs receive a fingerprinted stylesheet URL under `/css/page/`.
- Output URLs are fingerprinted.
- The public asset path does not depend on the page URL, so changing `slug` or aliases does not break asset URLs.

## Headless Fragments

- Use headless bundles for reusable content blocks, not for site shell or dynamic navigation.
- A minimal fragment bundle can live under `themes/banyan/content/fragments/...` with:

```yaml
build:
  list: never
  render: never
  publishResources: false
```

- Render a fragment from Markdown with the theme shortcode:

```md
{{< fragment path="/fragments/list/page-bundle-note" class="fragment-block" >}}
```

- The shortcode resolves the fragment with `site.GetPage` and renders its `.Content`.
- Parameters such as `class` belong to the renderer, not to the headless bundle itself.

## Navigation Bundles

- Use page bundles as the single source of truth for site navigation.
- Minimal nav metadata lives in front matter:

```yaml
nav_id: "products"
nav_slot: "primary"
nav_weight: 2
nav_menu_id: "products"
nav_parent_id: "home"
nav_include_self_child: true
nav_child_title: "Overview"
linkTitle: "Products"
```

- `nav_id` is the stable identifier for the nav item.
- `nav_slot` selects a render region such as `primary` or `footer`.
- `nav_weight` controls order within that slot.
- `linkTitle` is the preferred display label for navigation; if it is absent, the renderer falls back to `title`.
- `nav_href` is optional and only needed when the nav target differs from the bundle's own `RelPermalink`.
- `nav_menu_id` is for descendant pages or special pages that need to declare which top-level nav item they belong to.
- `nav_parent_id` registers a page as a secondary item under a top-level nav item. When real pages declare `nav_parent_id`, they override the fallback `desktop_children` list for that nav group, and custom renderers can reuse the same child set for page-local section cards or other branded navigation blocks.
- `nav_include_self_child` lets a top-level nav page prepend itself into its own secondary navigation group, which is useful when `/` or `/products/` should also behave as the first section item.
- `nav_child_title`, `nav_child_description`, `nav_child_weight`, and related `nav_child_*` fields tune that self-injected secondary item without changing the top-level nav label.
- `desktop_children` remains the declarative source for the desktop left-column secondary list.
- The actual page or section bundle should own the `nav_*` fields. Hidden theme bundles can still provide defaults such as `desktop_children`, but they should live under a non-public fragment/defaults path instead of pretending to be a real page bundle.

## Render Contract

- Use bundle front matter to declare which renderer family a page wants, instead of coupling page meaning to Hugo's default `layouts/<type>/...` lookup.
- Minimal render metadata:

```yaml
render_main: "home-brand"
render_breadcrumb: "none"
render_styles_variant: "home"
render_workspace: "dir"
render_mode: "bydate"
```

```yaml
render_main: "products-list"
render_breadcrumb: "none"
render_styles_variant: "products"
render_workspace: "products"
render_mode: "productsbynameasc"
```

- `render_main` selects the primary renderer partial under `layouts/partials/render/main/`.
- `render_breadcrumb` selects the breadcrumb renderer partial under `layouts/partials/render/breadcrumb/`.
- `render_styles_variant` chooses the shared style bundle variant.
- `render_workspace` declares the desktop workspace profile such as `none`, `dir`, `products`, `tags`, or `udc`.
- `render_mode` passes a renderer-specific default sort or display mode.
- Theme layouts should stay thin and delegate to these declared renderers; page meaning belongs in content bundles, while renderer implementation stays in `layouts/partials/render/...`.

## Bundle Paths

- Published page bundles should follow the final URL path whenever Hugo allows it:
  - `/products/` -> `content/products/index.md`
  - `/signals/` -> `content/signals/index.md`
  - `/foo/` -> `content/foo/index.md`
- Hugo home is the main exception: `/` still maps to `content/_index.md`.
- Hidden defaults and reusable fragments should live under non-public paths such as `themes/banyan/content/fragments/...`, not under page-like paths that imply a public URL.

## Current Trial Pages

- `themes/banyan/content/prefetch-debug/index.md`
- `themes/banyan/content/me/index.md`
- `themes/banyan/content/offline/index.md`
- `themes/banyan/content/about/index.md`
- site root `content/_index.md`
- `themes/banyan/content/products/index.md`

## Next Candidates

- front matter-driven fragment slots such as `fragments_after_list`
