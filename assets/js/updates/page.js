import '../back-links.js';
import { bindUpdateUi, renderUpdateUi } from './ui.js';

const updates = window.BanyanServiceWorkerManagerRuntime?.updates;
if (updates) {
    updates.subscribe(({ status, latencyMs }) => void renderUpdateUi(status, latencyMs));
    bindUpdateUi(() => void updates.check());
} else {
    void renderUpdateUi('unavailable', null);
}
