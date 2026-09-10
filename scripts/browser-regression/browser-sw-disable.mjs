import { runBrowserRegression } from './run.mjs';
import { swDisableScenarios } from './sw-disable.mjs';

await runBrowserRegression({
    headless: true,
    modeName: 'browser-sw-disable',
    requireUpgradePair: true,
    scenarios: swDisableScenarios,
});
