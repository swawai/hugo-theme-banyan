import { initEntryBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbMenus } from './breadcrumb-menu.js';
import { runBreadcrumbPreview } from './breadcrumb-preview.js';

runBreadcrumbPreview();

document.addEventListener('DOMContentLoaded', () => {
    initBreadcrumbMenus();
    initEntryBreadcrumb();
});
