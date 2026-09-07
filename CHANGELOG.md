# Changelog

All notable Banyan theme changes are tracked here.

The root site may keep its own changelog for site-specific content and
deployment decisions. This file is for reusable theme behavior, release notes,
and migration decisions.

## [Unreleased]

### Added

- Added a multilingual site-information section and a `section-index` layout
  that lists direct children by weight using the shared collection rows.
- Added a release migration plan for separating theme-owned files, site-owned
  overrides, and example-site resources.
- Recorded the 2026-06-11 root-site release audit baseline, current resource
  classification snapshot, first production-content cleanup, and root-owned
  content inventory handoff.
- Rebuilt `exampleSite` as a minimal consumer site with structural Hugo config,
  taxonomy roots, and one demo article.

### Changed

- Aligned section index headings and column widths with the shared collection
  styles, keeping site-information lists compact on desktop and narrow screens.
- Moved default about and changelog bundles under `content/site/`, preserving
  their public URLs and updating navigation, footer, and agent-access lookups.
- Made security, HTML audit, browser regression, and speculation-rules checks
  less dependent on swaw.com-specific defaults.
