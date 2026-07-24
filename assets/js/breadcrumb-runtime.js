import { initEntryBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbColumnSort } from './breadcrumb-column-sort.js';
import { initBreadcrumbMenus } from './breadcrumb-menu.js';
import { runBreadcrumbPreview } from './breadcrumb-preview.js';

runBreadcrumbPreview();

document.addEventListener('DOMContentLoaded', () => {
    initBreadcrumbColumnSort();
    initBreadcrumbMenus();
    initEntryBreadcrumb();
});
