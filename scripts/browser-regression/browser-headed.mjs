import { runBrowserRegression } from './run.mjs';

await runBrowserRegression({
    headless: false,
    modeName: 'browser-headed'
});
