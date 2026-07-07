import fs from 'node:fs/promises';
import path from 'node:path';

const defaultPublicDir = 'public';
const siteOrigin = 'https://swaw.com';
const maxGeneratedShareImageBytes = 500_000;
const defaultResponsiveImageConfig = Object.freeze({
    maxWidth: 1600,
    sizes: 'auto, (max-width: 820px) calc(100vw - 32px), 800px'
});
const targetShareImageRatio = 1200 / 630;
const maxShareImageRatioDrift = 0.08;
const localContentImagePattern = /\.(?:jpe?g|png|webp)(?:[?#]|$)/i;

function printHelp() {
    console.log(`Usage:
  node themes/banyan/scripts/checks/check-image-delivery.mjs [publicDir] [--check]

Examples:
  bun run check:images
  node themes/banyan/scripts/checks/check-image-delivery.mjs temp_workspace/public/260707-images --check

Notes:
  - Default mode prints a report and does not fail.
  - --check exits non-zero when generated content images miss the delivery contract.
`);
}

function parseCli(argv) {
    const options = {
        publicDir: defaultPublicDir,
        check: false,
        help: false
    };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--check') {
            options.check = true;
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
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
            files.push(absolutePath);
        }
    }

    return files;
}

function decodeHtmlAttribute(value) {
    return `${value ?? ''}`
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function extractTagAttribute(tagText, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`, 'i');
    const match = tagText.match(pattern);
    if (!match) {
        return '';
    }
    return decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? '');
}

function extractStartTags(text, tagName) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = [];
    const pattern = new RegExp(`<${escapedTagName}\\b[^>]*>`, 'gi');

    for (const match of text.matchAll(pattern)) {
        tags.push({
            text: match[0],
            index: match.index ?? 0
        });
    }

    return tags;
}

function hasClass(tagText, className) {
    return extractTagAttribute(tagText, 'class')
        .split(/\s+/)
        .includes(className);
}

function hasRelToken(tagText, relToken) {
    return extractTagAttribute(tagText, 'rel')
        .split(/\s+/)
        .some((token) => token.toLowerCase() === relToken.toLowerCase());
}

function extractTomlSection(text, sectionName) {
    const sectionPattern = /^\s*\[([^\]]+)\]\s*$/gm;
    let sectionStart = -1;
    let sectionEnd = text.length;

    for (const match of text.matchAll(sectionPattern)) {
        const currentName = (match[1] ?? '').trim();
        if (currentName === sectionName) {
            sectionStart = (match.index ?? 0) + match[0].length;
            continue;
        }
        if (sectionStart !== -1) {
            sectionEnd = match.index ?? text.length;
            break;
        }
    }

    return sectionStart === -1 ? '' : text.slice(sectionStart, sectionEnd);
}

function parseTomlInteger(section, key) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=\\s*(\\d+)\\s*(?:#.*)?$`, 'm');
    const match = section.match(pattern);
    if (!match) {
        return null;
    }

    const value = Number.parseInt(match[1], 10);
    return Number.isInteger(value) ? value : null;
}

function parseTomlString(section, key) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=\\s*(["'])(.*?)\\1\\s*(?:#.*)?$`, 'm');
    const match = section.match(pattern);
    return match ? match[2] : null;
}

async function readResponsiveImageConfig(siteRoot) {
    const config = { ...defaultResponsiveImageConfig };
    const configPaths = [
        path.join(siteRoot, 'themes', 'banyan', 'hugo.toml'),
        path.join(siteRoot, 'hugo.toml')
    ];

    for (const configPath of configPaths) {
        let text = '';
        try {
            text = await fs.readFile(configPath, 'utf8');
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
            continue;
        }

        const section = extractTomlSection(text, 'params.media.responsive_images');
        if (!section) {
            continue;
        }

        const sizes = parseTomlString(section, 'sizes');
        if (sizes !== null) {
            config.sizes = sizes.trim();
        }

        const maxWidth = parseTomlInteger(section, 'max_width');
        if (maxWidth !== null) {
            config.maxWidth = maxWidth;
        }
    }

    if (!config.sizes) {
        throw new Error('params.media.responsive_images.sizes cannot be empty.');
    }
    if (!Number.isInteger(config.maxWidth) || config.maxWidth <= 0) {
        throw new Error(`params.media.responsive_images.max_width must be a positive integer, got ${JSON.stringify(config.maxWidth)}.`);
    }

    return config;
}

function isGeneratedContentImageUrl(rawUrl) {
    const url = `${rawUrl ?? ''}`.trim();
    if (!url || !localContentImagePattern.test(url)) {
        return false;
    }

    if (url.startsWith('/media/content/')) {
        return true;
    }

    try {
        const parsed = new URL(url, siteOrigin);
        return parsed.origin === siteOrigin && parsed.pathname.startsWith('/media/content/');
    } catch {
        return false;
    }
}

function getUrlPathname(rawUrl) {
    try {
        return new URL(rawUrl, siteOrigin).pathname;
    } catch {
        return rawUrl;
    }
}

function isJpegUrl(rawUrl) {
    return /\.jpe?g(?:[?#]|$)/i.test(getUrlPathname(rawUrl));
}

function getPublicAssetPath(publicDir, rawUrl) {
    let pathname = '';
    try {
        pathname = new URL(rawUrl, siteOrigin).pathname;
    } catch {
        pathname = rawUrl;
    }

    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
    if (!relativePath) {
        return null;
    }

    return path.join(publicDir, relativePath);
}

async function getPublicAssetSize(publicDir, rawUrl) {
    const assetPath = getPublicAssetPath(publicDir, rawUrl);
    if (!assetPath) {
        return null;
    }

    try {
        const stat = await fs.stat(assetPath);
        return stat.size;
    } catch {
        return null;
    }
}

async function getJpegDimensions(publicDir, rawUrl) {
    const assetPath = getPublicAssetPath(publicDir, rawUrl);
    if (!assetPath) {
        return null;
    }

    let buffer = null;
    try {
        buffer = await fs.readFile(assetPath);
    } catch {
        return null;
    }

    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return null;
    }

    let offset = 2;
    while (offset + 9 < buffer.length) {
        while (buffer[offset] === 0xff) {
            offset += 1;
        }

        const marker = buffer[offset];
        offset += 1;
        if (marker === 0xd9 || marker === 0xda) {
            return null;
        }
        if (offset + 2 > buffer.length) {
            return null;
        }

        const length = buffer.readUInt16BE(offset);
        if (length < 2 || offset + length > buffer.length) {
            return null;
        }

        const isStartOfFrame = [
            0xc0, 0xc1, 0xc2, 0xc3,
            0xc5, 0xc6, 0xc7,
            0xc9, 0xca, 0xcb,
            0xcd, 0xce, 0xcf
        ].includes(marker);
        if (isStartOfFrame && length >= 7) {
            return {
                height: buffer.readUInt16BE(offset + 3),
                width: buffer.readUInt16BE(offset + 5)
            };
        }

        offset += length;
    }

    return null;
}

function findContainingTagBefore(text, index, tagName, className) {
    const windowStart = Math.max(0, index - 2000);
    const before = text.slice(windowStart, index);
    const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    let candidate = null;

    for (const match of before.matchAll(pattern)) {
        const tagText = match[0];
        if (!className || hasClass(tagText, className)) {
            candidate = {
                text: tagText,
                absoluteIndex: windowStart + (match.index ?? 0)
            };
        }
    }

    if (!candidate) {
        return null;
    }

    const closePattern = new RegExp(`</${tagName}>`, 'gi');
    for (const match of before.slice(candidate.absoluteIndex - windowStart).matchAll(closePattern)) {
        if ((candidate.absoluteIndex - windowStart + (match.index ?? 0)) > candidate.absoluteIndex) {
            return null;
        }
    }

    return candidate;
}

function extractSrcsetWidths(srcset) {
    return `${srcset ?? ''}`
        .split(',')
        .map((candidate) => {
            const match = candidate.trim().match(/\s(\d+)w$/);
            return match ? Number.parseInt(match[1], 10) : 0;
        })
        .filter((width) => Number.isInteger(width) && width > 0);
}

async function inspectImageDelivery(relativePath, html, publicDir, seenShareRatioWarningUrls, responsiveImageConfig) {
    const issues = [];
    const warnings = [];
    let contentImageCount = 0;
    let responsiveImageCount = 0;
    let shareImageCount = 0;

    for (const tag of extractStartTags(html, 'meta')) {
        const property = extractTagAttribute(tag.text, 'property');
        const name = extractTagAttribute(tag.text, 'name');
        if (property !== 'og:image' && name !== 'twitter:image') {
            continue;
        }

        const content = extractTagAttribute(tag.text, 'content');
        if (!isGeneratedContentImageUrl(content)) {
            continue;
        }

        shareImageCount += 1;
        if (!isJpegUrl(content)) {
            issues.push(`${relativePath}: ${property || name} should use generated jpg share image, got ${content}`);
            continue;
        }

        const size = await getPublicAssetSize(publicDir, content);
        if (size === null) {
            issues.push(`${relativePath}: ${property || name} points to missing generated share image, got ${content}`);
        } else if (size > maxGeneratedShareImageBytes) {
            issues.push(`${relativePath}: ${property || name} generated share image is too large (${size} bytes > ${maxGeneratedShareImageBytes} bytes), got ${content}`);
        }

        if (!seenShareRatioWarningUrls.has(content)) {
            seenShareRatioWarningUrls.add(content);
            const dimensions = await getJpegDimensions(publicDir, content);
            if (dimensions) {
                const ratio = dimensions.width / dimensions.height;
                const drift = Math.abs(ratio - targetShareImageRatio) / targetShareImageRatio;
                if (drift > maxShareImageRatioDrift) {
                    warnings.push(`${relativePath}: generated share image ratio is ${dimensions.width}x${dimensions.height}; source is outside the 1200x630 card ratio target, got ${content}`);
                }
            }
        }
    }

    for (const tag of extractStartTags(html, 'img')) {
        const src = extractTagAttribute(tag.text, 'src');
        if (!isGeneratedContentImageUrl(src)) {
            continue;
        }

        contentImageCount += 1;
        const picture = findContainingTagBefore(html, tag.index, 'picture', 'md-responsive-image');
        const link = findContainingTagBefore(html, tag.index, 'a', 'md-image-link');
        const beforeImage = html.slice(Math.max(0, tag.index - 2000), tag.index);
        const webpSource = extractStartTags(beforeImage, 'source')
            .reverse()
            .find((sourceTag) => extractTagAttribute(sourceTag.text, 'type').toLowerCase() === 'image/webp');

        if (!picture) {
            issues.push(`${relativePath}: content image ${src} is not wrapped in picture.md-responsive-image`);
            continue;
        }
        if (!link) {
            issues.push(`${relativePath}: content image ${src} is not wrapped in a.md-image-link`);
            continue;
        }
        if (extractTagAttribute(link.text, 'target') !== '_blank' || !hasRelToken(link.text, 'noopener')) {
            issues.push(`${relativePath}: content image link for ${src} should open the original in a new safe tab`);
        }
        const webpSrcset = webpSource ? extractTagAttribute(webpSource.text, 'srcset') : '';
        const webpSizes = webpSource ? extractTagAttribute(webpSource.text, 'sizes') : '';
        if (!webpSource || !webpSrcset) {
            issues.push(`${relativePath}: content image ${src} is missing a webp source srcset`);
        } else {
            const width = Number.parseInt(extractTagAttribute(tag.text, 'width'), 10);
            const srcsetWidths = extractSrcsetWidths(webpSrcset);
            const maxSrcsetWidth = Math.max(...srcsetWidths, 0);
            const expectedMaxSrcsetWidth = Math.min(width, responsiveImageConfig.maxWidth);
            if (Number.isInteger(width) && width > 0 && maxSrcsetWidth !== expectedMaxSrcsetWidth) {
                issues.push(`${relativePath}: content image ${src} max webp candidate is ${maxSrcsetWidth}w; expected ${expectedMaxSrcsetWidth}w to avoid upscaling or over-fetching`);
            }
        }
        if (!webpSizes) {
            issues.push(`${relativePath}: content image ${src} is missing a webp source sizes attribute`);
        } else if (webpSizes !== responsiveImageConfig.sizes) {
            issues.push(`${relativePath}: content image ${src} sizes is ${JSON.stringify(webpSizes)}; expected ${JSON.stringify(responsiveImageConfig.sizes)}`);
        }
        if (!extractTagAttribute(tag.text, 'width') || !extractTagAttribute(tag.text, 'height')) {
            issues.push(`${relativePath}: content image ${src} should include width and height attributes`);
        }
        if (extractTagAttribute(tag.text, 'loading') !== 'lazy' || extractTagAttribute(tag.text, 'decoding') !== 'async') {
            issues.push(`${relativePath}: content image ${src} should keep lazy async loading`);
        }

        responsiveImageCount += 1;
    }

    return {
        issues,
        warnings,
        contentImageCount,
        responsiveImageCount,
        shareImageCount
    };
}

async function main() {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const publicDir = path.resolve(process.cwd(), options.publicDir);
    const responsiveImageConfig = await readResponsiveImageConfig(process.cwd());
    const htmlFiles = await collectHtmlFiles(publicDir);
    const totals = {
        issues: [],
        warnings: [],
        contentImageCount: 0,
        responsiveImageCount: 0,
        shareImageCount: 0
    };
    const seenShareRatioWarningUrls = new Set();

    for (const file of htmlFiles) {
        const html = await fs.readFile(file, 'utf8');
        const relativePath = path.relative(publicDir, file).split(path.sep).join('/');
        const result = await inspectImageDelivery(relativePath, html, publicDir, seenShareRatioWarningUrls, responsiveImageConfig);
        totals.issues.push(...result.issues);
        totals.warnings.push(...result.warnings);
        totals.contentImageCount += result.contentImageCount;
        totals.responsiveImageCount += result.responsiveImageCount;
        totals.shareImageCount += result.shareImageCount;
    }

    console.log(`Image delivery report for ${path.relative(process.cwd(), publicDir) || publicDir}`);
    console.log(`  Content images: ${totals.contentImageCount}`);
    console.log(`  Responsive images: ${totals.responsiveImageCount}`);
    console.log(`  Local share images: ${totals.shareImageCount}`);

    if (totals.issues.length > 0) {
        console.log(`\nIssues (${totals.issues.length}):`);
        for (const issue of totals.issues) {
            console.log(`  - ${issue}`);
        }
    } else {
        console.log('\nNo image delivery issues found.');
    }

    if (totals.warnings.length > 0) {
        console.log(`\nWarnings (${totals.warnings.length}):`);
        for (const warning of totals.warnings) {
            console.log(`  - ${warning}`);
        }
    }

    if (options.check && totals.issues.length > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
