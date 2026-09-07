import { initEntryBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbColumnSort } from './breadcrumb-column-sort.js';
import { runBreadcrumbPreview } from './breadcrumb-preview.js';

runBreadcrumbPreview();

document.addEventListener('DOMContentLoaded', () => {
    initBreadcrumbColumnSort();
    initEntryBreadcrumb();
});
