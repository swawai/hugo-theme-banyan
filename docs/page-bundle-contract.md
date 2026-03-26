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
- A minimal fragment bundle can live under `content/fragments/...` with:

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

## Current Trial Pages

- `content/prefetch-debug/index.md`
- `content/me/index.md`
- `content/offline/index.md`
- site root `content/about/index.md`
- site root `content/_index.md`
- site root `content/resources/_index.md`

## Next Candidates

- front matter-driven fragment slots such as `fragments_after_list`
