import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const repoRoot = process.cwd();
const defaultPublicDir = 'public';
const defaultTop = 8;

// These guardrails intentionally target minified production output.
// Run the script without --check when you only want an exploratory report.
const productionGuardrails = [
    {
        label: 'home',
        relativePath: 'index.html',
        maxRawBytes: 16_000,
        maxGzipBytes: 5_500,
        maxBreadcrumbPayloadBytes: 16,
        maxBreadcrumbSourceCount: 0
    },
    {
        label: 'xvenv',
        relativePath: 'p/xvenv/index.html',
        maxRawBytes: 58_000,
        maxGzipBytes: 17_000,
        maxBreadcrumbPayloadBytes: 9_000,
        maxBreadcrumbSourceCount: 6
    },
    {
        label: 'zh-products',
        relativePath: 'zh/d/products/index.html',
        maxRawBytes: 38_000,
        maxGzipBytes: 11_000,
        maxBreadcrumbPayloadBytes: 1_600,
        maxBreadcrumbSourceCount: 1
    }
];

function printHelp() {
    console.log(`Usage:
  node themes/banyan/scripts/check-public-html.mjs [publicDir] [--check] [--top N]

Examples:
  npm run check:public
  npm run check:public:prod
  node themes/banyan/scripts/check-public-html.mjs temp_workspace/public/2605010948-page-local-compact-min --check

Notes:
  - Default mode prints a report only.
  - --check enables production guardrails and exits non-zero on regressions.
  - Guardrails are calibrated for minified production HTML, not hugo server output.
`);
}

function parseCli(argv) {
    const options = {
        publicDir: defaultPublicDir,
        check: false,
        top: defaultTop
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg) {
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--check') {
            options.check = true;
            continue;
        }
        if (arg === '--top') {
            const nextArg = argv[index + 1];
            const parsed = Number.parseInt(nextArg ?? '', 10);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new Error(`Invalid value for --top: ${nextArg ?? '<missing>'}`);
            }
            options.top = parsed;
            index += 1;
            continue;
        }
        if (arg.startsWith('--top=')) {
            const parsed = Number.parseInt(arg.slice('--top='.length), 10);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new Error(`Invalid value for --top: ${arg.slice('--top='.length)}`);
            }
            options.top = parsed;
            continue;
        }
        if (arg.startsWith('-')) {
            throw new Error(`Unsupported option: ${arg}`);
        }
        if (options.publicDir !== defaultPublicDir) {
            throw new Error(`Only one publicDir can be provided, got extra argument: ${arg}`);
        }
        options.publicDir = arg;
    }

    return options;
}

async function collectHtmlFiles(rootDir, currentDir = rootDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectHtmlFiles(rootDir, absolutePath));
            continue;
        }
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') {
            continue;
        }
        files.push(absolutePath);
    }

    return files;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const kib = bytes / 1024;
    if (kib < 1024) {
        return `${kib.toFixed(1)} KiB`;
    }
    return `${(kib / 1024).toFixed(2)} MiB`;
}

function formatByteMetric(bytes, { includeExactBytes = true } = {}) {
    const readable = formatBytes(bytes);
    if (!includeExactBytes || readable === `${bytes} B`) {
        return readable;
    }
    return `${readable} (${bytes} B)`;
}

function decodeHtmlAttribute(value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function extractAttribute(text, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedName}=(?:"([^"]*)"|'([^']*)')`);
    const match = text.match(pattern);
    if (!match) {
        return '';
    }
    return match[1] ?? match[2] ?? '';
}

function hasCanonical(text) {
    return /<link\b[^>]*\brel=(?:"canonical"|'canonical'|canonical(?:\s|>|\/))/i.test(text);
}

function hasMainBundle(text) {
    return /\/js\/main(?:\.min)?\.[^"' >]+/i.test(text);
}

function isRedirectPage(text) {
    return /<meta\b[^>]*\bhttp-equiv=(?:"refresh"|'refresh'|refresh(?:\s|>|\/))/i.test(text);
}

function summarizeRows(rows, limit, selector) {
    return [...rows]
        .sort((left, right) => selector(right) - selector(left) || left.relativePath.localeCompare(right.relativePath))
        .slice(0, limit);
}

function printRankedRows(title, rows, valueSelector) {
    console.log(`\n${title}`);
    for (const row of rows) {
        console.log(
            `${row.relativePath}\traw=${formatByteMetric(row.rawBytes)}\tgzip=${formatByteMetric(row.gzipBytes)}\tbreadcrumb=${formatByteMetric(row.breadcrumbPayloadBytes)}\tsources=${row.breadcrumbSourceCount}\tkey=${formatByteMetric(valueSelector(row))}`
        );
    }
}

function printSentinelRows(rows) {
    console.log('\nSentinel pages');
    for (const row of rows) {
        if (!row) {
            continue;
        }
        console.log(
            `${row.relativePath}\traw=${formatByteMetric(row.rawBytes)}\tgzip=${formatByteMetric(row.gzipBytes)}\tbreadcrumb=${formatByteMetric(row.breadcrumbPayloadBytes)}\tsources=${row.breadcrumbSourceCount}`
        );
        if (row.breadcrumbSourcePaths.length > 0) {
            console.log(`  source_paths=${row.breadcrumbSourcePaths.join(', ')}`);
        }
    }
}

async function inspectHtmlFile(rootDir, absolutePath) {
    const buffer = await fs.readFile(absolutePath);
    const text = buffer.toString('utf8');
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
    const encodedBreadcrumbSources = extractAttribute(text, 'data-entry-breadcrumb-sources');

    let breadcrumbPayloadBytes = 0;
    let breadcrumbSourceCount = 0;
    let breadcrumbSourcePaths = [];
    let breadcrumbParseError = '';

    if (encodedBreadcrumbSources !== '') {
        const decodedBreadcrumbSources = decodeHtmlAttribute(encodedBreadcrumbSources);
        breadcrumbPayloadBytes = Buffer.byteLength(decodedBreadcrumbSources);
        try {
            const parsed = JSON.parse(decodedBreadcrumbSources);
            if (!Array.isArray(parsed)) {
                breadcrumbParseError = 'data-entry-breadcrumb-sources is not a JSON array';
            } else {
                breadcrumbSourceCount = parsed.length;
                breadcrumbSourcePaths = parsed
                    .map((entry) => {
                        if (!entry || typeof entry !== 'object') {
                            return '';
                        }
                        const logicalPath = entry.logical_path;
                        return typeof logicalPath === 'string' ? logicalPath : '';
                    })
                    .filter(Boolean);
            }
        } catch (error) {
            breadcrumbParseError = error instanceof Error ? error.message : String(error);
        }
    }

    return {
        absolutePath,
        relativePath,
        rawBytes: buffer.length,
        gzipBytes: gzipSync(buffer, { level: 9 }).length,
        isRedirect: isRedirectPage(text),
        hasCanonical: hasCanonical(text),
        hasMainBundle: hasMainBundle(text),
        breadcrumbPayloadBytes,
        breadcrumbSourceCount,
        breadcrumbSourcePaths,
        breadcrumbParseError
    };
}

function buildIntegrityIssues(rows) {
    const issues = [];

    for (const row of rows) {
        if (!row.hasCanonical) {
            issues.push(`Missing canonical link: ${row.relativePath}`);
        }
        if (!row.isRedirect && !row.hasMainBundle) {
            issues.push(`Missing main JS bundle on non-redirect page: ${row.relativePath}`);
        }
        if (row.breadcrumbParseError) {
            issues.push(`Invalid breadcrumb payload on ${row.relativePath}: ${row.breadcrumbParseError}`);
        }
    }

    return issues;
}

function buildGuardrailIssues(rowsByPath) {
    const issues = [];

    for (const guardrail of productionGuardrails) {
        const row = rowsByPath.get(guardrail.relativePath);
        if (!row) {
            issues.push(`Missing sentinel page: ${guardrail.relativePath}`);
            continue;
        }
        if (row.rawBytes > guardrail.maxRawBytes) {
            issues.push(
                `${guardrail.label} raw HTML exceeded budget: ${formatByteMetric(row.rawBytes)} > ${formatByteMetric(guardrail.maxRawBytes)} (${guardrail.relativePath})`
            );
        }
        if (row.gzipBytes > guardrail.maxGzipBytes) {
            issues.push(
                `${guardrail.label} gzip HTML exceeded budget: ${formatByteMetric(row.gzipBytes)} > ${formatByteMetric(guardrail.maxGzipBytes)} (${guardrail.relativePath})`
            );
        }
        if (row.breadcrumbPayloadBytes > guardrail.maxBreadcrumbPayloadBytes) {
            issues.push(
                `${guardrail.label} breadcrumb payload exceeded budget: ${formatByteMetric(row.breadcrumbPayloadBytes)} > ${formatByteMetric(guardrail.maxBreadcrumbPayloadBytes)} (${guardrail.relativePath})`
            );
        }
        if (row.breadcrumbSourceCount > guardrail.maxBreadcrumbSourceCount) {
            issues.push(
                `${guardrail.label} breadcrumb source count exceeded budget: ${row.breadcrumbSourceCount} > ${guardrail.maxBreadcrumbSourceCount} (${guardrail.relativePath})`
            );
        }
    }

    return issues;
}

async function main() {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const publicRoot = path.resolve(repoRoot, options.publicDir);
    await fs.access(publicRoot);

    const htmlPaths = await collectHtmlFiles(publicRoot);
    if (htmlPaths.length === 0) {
        throw new Error(`No HTML files found under: ${publicRoot}`);
    }

    const rows = [];
    for (const htmlPath of htmlPaths) {
        rows.push(await inspectHtmlFile(publicRoot, htmlPath));
    }

    const rowsByPath = new Map(rows.map((row) => [row.relativePath, row]));
    const rawTotal = rows.reduce((sum, row) => sum + row.rawBytes, 0);
    const gzipTotal = rows.reduce((sum, row) => sum + row.gzipBytes, 0);
    const breadcrumbTotal = rows.reduce((sum, row) => sum + row.breadcrumbPayloadBytes, 0);
    const redirectCount = rows.filter((row) => row.isRedirect).length;

    console.log('Public HTML audit');
    console.log(`Root\t${publicRoot}`);
    console.log(`Mode\t${options.check ? 'report + check' : 'report only'}`);
    console.log(`HTML files\t${rows.length}`);
    console.log(`Redirect pages\t${redirectCount}`);
    console.log(`Raw total\t${rawTotal}\t${formatBytes(rawTotal)}`);
    console.log(`Gzip total\t${gzipTotal}\t${formatBytes(gzipTotal)}`);
    console.log(`Breadcrumb payload total\t${breadcrumbTotal}\t${formatBytes(breadcrumbTotal)}`);
    console.log(`Raw average\t${Math.round(rawTotal / rows.length)}\t${formatBytes(rawTotal / rows.length)}`);
    console.log(`Gzip average\t${Math.round(gzipTotal / rows.length)}\t${formatBytes(gzipTotal / rows.length)}`);

    printRankedRows(
        `\nLargest raw HTML pages (top ${options.top})`,
        summarizeRows(rows, options.top, (row) => row.rawBytes),
        (row) => row.rawBytes
    );
    printRankedRows(
        `Largest gzip HTML pages (top ${options.top})`,
        summarizeRows(rows, options.top, (row) => row.gzipBytes),
        (row) => row.gzipBytes
    );
    printRankedRows(
        `Largest breadcrumb payload pages (top ${options.top})`,
        summarizeRows(rows, options.top, (row) => row.breadcrumbPayloadBytes),
        (row) => row.breadcrumbPayloadBytes
    );

    printSentinelRows(
        productionGuardrails.map((guardrail) => rowsByPath.get(guardrail.relativePath))
    );

    const integrityIssues = buildIntegrityIssues(rows);
    const guardrailIssues = options.check ? buildGuardrailIssues(rowsByPath) : [];

    if (integrityIssues.length > 0) {
        console.log('\nIntegrity issues');
        for (const issue of integrityIssues) {
            console.log(`- ${issue}`);
        }
    }

    if (guardrailIssues.length > 0) {
        console.log('\nGuardrail issues');
        for (const issue of guardrailIssues) {
            console.log(`- ${issue}`);
        }
    }

    if (integrityIssues.length > 0 || guardrailIssues.length > 0) {
        process.exit(1);
    }

    console.log('\nPublic HTML audit passed.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
