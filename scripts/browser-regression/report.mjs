import fs from 'node:fs';
import path from 'node:path';

function formatDuration(durationMs) {
    return `${durationMs}ms`;
}

export function renderSummary(report) {
    const lines = [
        'Browser regression report',
        `Mode\t${report.mode}`,
        `Output\t${report.outputDir}`,
        `Primary build\t${report.primaryBuildDir}`,
        `Upgrade from\t${report.upgradeFromDir || '-'}`,
        `Upgrade to\t${report.upgradeToDir || '-'}`,
        `Passed\t${report.totals.passed}`,
        `Failed\t${report.totals.failed}`,
        `Skipped\t${report.totals.skipped}`,
        ''
    ];

    for (const scenario of report.scenarios) {
        lines.push(`[${scenario.status.toUpperCase()}] ${scenario.id} (${formatDuration(scenario.durationMs)})`);
        if (scenario.message) lines.push(`  ${scenario.message}`);
        if (scenario.artifacts?.screenshot) lines.push(`  screenshot: ${scenario.artifacts.screenshot}`);
        if (scenario.artifacts?.trace) lines.push(`  trace: ${scenario.artifacts.trace}`);
    }

    return lines.join('\n');
}

export function writeReportFiles(report) {
    fs.mkdirSync(report.outputDir, { recursive: true });
    const reportJsonPath = path.join(report.outputDir, 'report.json');
    const summaryPath = path.join(report.outputDir, 'summary.txt');
    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(summaryPath, renderSummary(report));
    return {
        reportJsonPath,
        summaryPath
    };
}
