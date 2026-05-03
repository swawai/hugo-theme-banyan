import { runBrowserRegression } from './run.mjs';

await runBrowserRegression({
    headless: true,
    modeName: 'browser-trace',
    trace: true
});
