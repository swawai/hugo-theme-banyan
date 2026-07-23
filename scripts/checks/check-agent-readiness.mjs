import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const siteRoot = process.cwd();
const defaultPublicDir = 'public';
const legacyMarkdownOutputs = new Set(['AGENT_MARKDOWN', 'MARKDOWN']);
const expectedRobotsAgentHints = [
    'ChatGPT-User',
    'OAI-SearchBot',
    'GPTBot',
    'Google-Extended'
];

function printHelp() {
    console.log(`Usage:
  node themes/banyan/scripts/checks/check-agent-readiness.mjs [publicDir] [--check]

Examples:
  bun run check:agent
  bun run check:agent:prod
  node themes/banyan/scripts/checks/check-agent-readiness.mjs temp_workspace/public/260603-agent-readiness --check

Notes:
  - Default mode prints a report and does not fail on readiness issues.
  - --check exits non-zero when the agent-facing publishing contract is broken.
`);
}

function parseCli(argv) {
    const options = {
        publicDir: defaultPublicDir,
        check: false,
        help: false
    };

    for (const arg of argv) {
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

async function collectFiles(rootDir, predicate, currentDir = rootDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectFiles(rootDir, predicate, absolutePath));
            continue;
        }
        if (entry.isFile() && predicate(absolutePath, entry.name)) {
            files.push(absolutePath);
        }
    }

    return files;
}

async function fileExists(absolutePath) {
    try {
        await fs.access(absolutePath);
        return true;
    } catch {
        return false;
    }
}

async function readUtf8IfExists(absolutePath) {
    try {
        return await fs.readFile(absolutePath, 'utf8');
    } catch {
        return '';
    }
}

function toPublicRelativePath(rootDir, absolutePath) {
    return path.relative(rootDir, absolutePath).split(path.sep).join('/');
}

function normalizePublicRelativePath(relativePath) {
    let normalized = `${relativePath ?? ''}`.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized === '') {
        return 'index.html';
    }
    if (normalized.endsWith('/')) {
        normalized += 'index.html';
    }
    return normalized;
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
    return match ? decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function extractStartTags(text, tagName) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...text.matchAll(new RegExp(`<${escapedTagName}\\b[^>]*>`, 'gi'))]
        .map((match) => match[0]);
}

function hasRelToken(tagText, relToken) {
    return extractTagAttribute(tagText, 'rel')
        .split(/\s+/)
        .some((token) => token.toLowerCase() === relToken.toLowerCase());
}

function isIgnoredHref(href) {
    return href === ''
        || href.startsWith('#')
        || /^(?:data|javascript|mailto|tel):/i.test(href);
}

function stripMarkdownTitle(rawTarget) {
    let target = `${rawTarget ?? ''}`.trim();
    if (target.startsWith('<')) {
        const closeIndex = target.indexOf('>');
        if (closeIndex >= 0) {
            return target.slice(1, closeIndex).trim();
        }
    }
    return target.replace(/\s+["'][\s\S]*$/, '').trim();
}

function extractMarkdownLinks(text) {
    const links = [];
    const pattern = /(!?)\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g;

    for (const match of text.matchAll(pattern)) {
        const target = stripMarkdownTitle(match[2] ?? '');
        if (target) {
            links.push({
                isImage: match[1] === '!',
                target
            });
        }
    }

    return links;
}

function isMarkdownTarget(target) {
    try {
        return new URL(target, 'https://agent-audit.local/').pathname.toLowerCase().endsWith('.md');
    } catch {
        return `${target ?? ''}`.split(/[?#]/, 1)[0].toLowerCase().endsWith('.md');
    }
}

function extractCanonicalOrigin(llmsText) {
    const match = llmsText.match(/^Canonical site:\s*(\S+)/mi);
    if (!match) {
        return '';
    }

    try {
        return new URL(match[1]).origin;
    } catch {
        return '';
    }
}

function hasPerPageMirrorList(llmsText) {
    return /^\s*Mirrors:/m.test(llmsText);
}

function resolvePublicPathFromHref(href, { canonicalOrigin, currentRelativePath = '' }) {
    const trimmed = decodeHtmlAttribute(`${href ?? ''}`.trim());
    if (isIgnoredHref(trimmed)) {
        return { kind: 'ignored', relativePath: '' };
    }

    try {
        const basePath = currentRelativePath || 'index.html';
        const url = new URL(trimmed, `https://agent-audit.local/${basePath}`);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { kind: 'external', relativePath: '' };
        }
        if (url.origin !== 'https://agent-audit.local' && canonicalOrigin && url.origin !== canonicalOrigin) {
            return { kind: 'external', relativePath: '' };
        }
        if (url.origin !== 'https://agent-audit.local' && !canonicalOrigin) {
            return { kind: 'external', relativePath: '' };
        }

        return {
            kind: 'local',
            relativePath: normalizePublicRelativePath(decodeURIComponent(url.pathname))
        };
    } catch (error) {
        return {
            kind: 'invalid',
            relativePath: '',
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

function extractFrontMatter(text) {
    const normalized = `${text ?? ''}`.replace(/^\uFEFF/, '');
    if (normalized.startsWith('---\n') || normalized.startsWith('---\r\n')) {
        return normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)?.[1] ?? '';
    }
    if (normalized.startsWith('+++\n') || normalized.startsWith('+++\r\n')) {
        return normalized.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n/)?.[1] ?? '';
    }
    return '';
}

function parseFrontMatterData(frontMatter, relativePath, issues) {
    if (!frontMatter.trim()) {
        return {};
    }
    try {
        const parsed = parseYaml(frontMatter);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        issues.push(`Content page front matter is not valid YAML: ${relativePath} (${error instanceof Error ? error.message : String(error)})`);
        return {};
    }
}

function outputNames(frontMatterData) {
    const raw = frontMatterData.outputs;
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return values
        .map((value) => `${value ?? ''}`.trim().toUpperCase())
        .filter(Boolean);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function isExternalShareImage(value) {
    return /^https?:\/\//i.test(value);
}

async function readSiteLanguageInfo() {
    const configText = await readUtf8IfExists(path.join(siteRoot, 'hugo.toml'));
    const defaultLanguage = configText.match(/^\s*defaultContentLanguage\s*=\s*["']([^"']+)["']/mi)?.[1] ?? 'en';
    const languages = new Set([defaultLanguage]);

    for (const match of configText.matchAll(/^\s*\[languages\.([^\]\s]+)\]\s*$/gmi)) {
        if (!match[1].includes('.')) {
            languages.add(match[1]);
        }
    }

    return {
        defaultLanguage,
        languages: [...languages].sort((a, b) => b.length - a.length)
    };
}

function parseContentIdentity(relativePath, languageInfo) {
    const contentRelativePath = relativePath.replace(/^content\//, '');
    const dirName = path.posix.dirname(contentRelativePath);
    const dir = dirName === '.' ? '' : dirName;
    const fileName = path.posix.basename(contentRelativePath);
    let stem = fileName.replace(/\.(?:md|markdown)$/i, '');
    let language = languageInfo.defaultLanguage;

    for (const candidate of languageInfo.languages) {
        const suffix = `.${candidate}`;
        if (stem.toLowerCase().endsWith(suffix.toLowerCase())) {
            language = candidate;
            stem = stem.slice(0, -suffix.length);
            break;
        }
    }

    return {
        dir,
        stem,
        language
    };
}

function contentRecordKey(dir, stem, language) {
    return `${dir}\u0000${stem}\u0000${language}`;
}

function parentContentDir(dir) {
    if (!dir) {
        return '';
    }
    const parent = path.posix.dirname(dir);
    return parent === '.' ? '' : parent;
}

function buildContentRecordIndex(records) {
    return new Map(records.map((record) => [
        contentRecordKey(record.identity.dir, record.identity.stem, record.identity.language),
        record
    ]));
}

function findSectionRecord(recordsByKey, dir, language) {
    return recordsByKey.get(contentRecordKey(dir, '_index', language)) ?? null;
}

function resolveShareImageRecord(record, recordsByKey, languageInfo) {
    const candidates = [record];
    let dir = record.identity.stem === '_index'
        ? parentContentDir(record.identity.dir)
        : record.identity.dir;

    while (dir) {
        const sectionRecord = findSectionRecord(recordsByKey, dir, record.identity.language);
        if (sectionRecord) {
            candidates.push(sectionRecord);
        }
        dir = parentContentDir(dir);
    }

    const homeRecord = findSectionRecord(recordsByKey, '', record.identity.language)
        ?? findSectionRecord(recordsByKey, '', languageInfo.defaultLanguage);
    if (homeRecord) {
        candidates.push(homeRecord);
    }

    return candidates.find((candidate) => hasOwn(candidate.frontMatterData, 'share_image')) ?? null;
}

async function inspectShareImageSetting({ record, recordsByKey, languageInfo, issues }) {
    if (hasOwn(record.frontMatterData, 'images')) {
        issues.push(`Content page uses legacy images front matter; use share_image instead: ${record.relativePath}`);
    }

    const ownerRecord = resolveShareImageRecord(record, recordsByKey, languageInfo);
    if (!ownerRecord) {
        issues.push(`Content page cannot resolve share_image from page, section, or language home: ${record.relativePath}`);
        return { configured: false, disabled: false, inherited: false };
    }

    const shareImage = ownerRecord.frontMatterData.share_image;
    const inherited = ownerRecord.relativePath !== record.relativePath;
    if (shareImage === false) {
        return { configured: false, disabled: true, inherited };
    }
    if (typeof shareImage !== 'string' || shareImage.trim() === '') {
        issues.push(`Content page share_image must be false or a non-empty string: ${ownerRecord.relativePath}`);
        return { configured: false, disabled: false, inherited };
    }

    const normalized = shareImage.trim();
    if (!isExternalShareImage(normalized)) {
        const localPath = normalized.startsWith('/')
            ? path.join(siteRoot, 'static', normalized.replace(/^\/+/, ''))
            : path.resolve(path.dirname(ownerRecord.contentPath), normalized);
        if (!await fileExists(localPath)) {
            issues.push(`Content page share_image points to a missing local file: ${ownerRecord.relativePath} -> ${shareImage}`);
        }
    }

    return { configured: true, disabled: false, inherited };
}

function isAgentIndexedContentRecord(record) {
    const { dir, stem } = record.identity;
    return stem === 'index' && (dir === 'about' || dir.startsWith('d/'));
}

async function inspectSourceSettings(issues) {
    const contentRoot = path.join(siteRoot, 'content');
    if (!await fileExists(contentRoot)) {
        return {
            contentFiles: 0,
            indexedContentFiles: 0,
            legacyMarkdownOptIns: 0,
            shareImageConfigured: 0,
            shareImageDisabled: 0,
            shareImageInherited: 0
        };
    }

    const languageInfo = await readSiteLanguageInfo();
    const contentFiles = await collectFiles(
        contentRoot,
        (_absolutePath, name) => /\.(?:md|markdown)$/i.test(name)
    );
    const records = [];

    for (const contentPath of contentFiles) {
        const relativePath = toPublicRelativePath(siteRoot, contentPath);
        const frontMatter = extractFrontMatter(await fs.readFile(contentPath, 'utf8'));
        records.push({
            contentPath,
            relativePath,
            frontMatterData: parseFrontMatterData(frontMatter, relativePath, issues),
            identity: parseContentIdentity(relativePath, languageInfo)
        });
    }

    const recordsByKey = buildContentRecordIndex(records);
    let indexedContentFiles = 0;
    let legacyMarkdownOptIns = 0;
    let shareImageConfigured = 0;
    let shareImageDisabled = 0;
    let shareImageInherited = 0;

    for (const record of records) {
        const legacyOutputs = outputNames(record.frontMatterData)
            .filter((name) => legacyMarkdownOutputs.has(name));
        if (legacyOutputs.length > 0) {
            legacyMarkdownOptIns += 1;
            issues.push(`Content page still configures a retired Markdown output (${legacyOutputs.join(', ')}): ${record.relativePath}`);
        }
        if (!isAgentIndexedContentRecord(record)) {
            continue;
        }

        indexedContentFiles += 1;
        const shareImage = await inspectShareImageSetting({
            record,
            recordsByKey,
            languageInfo,
            issues
        });
        if (shareImage.configured) {
            shareImageConfigured += 1;
        }
        if (shareImage.disabled) {
            shareImageDisabled += 1;
        }
        if (shareImage.inherited) {
            shareImageInherited += 1;
        }
    }

    return {
        contentFiles: contentFiles.length,
        indexedContentFiles,
        legacyMarkdownOptIns,
        shareImageConfigured,
        shareImageDisabled,
        shareImageInherited
    };
}

async function inspectRobots(publicRoot, issues) {
    const robotsText = await readUtf8IfExists(path.join(publicRoot, 'robots.txt'));
    if (!robotsText) {
        issues.push('Missing robots.txt.');
        return { hasRobots: false, userAgentCount: 0 };
    }

    const userAgentCount = (robotsText.match(/^User-agent:/gim) ?? []).length;
    const missingAgentHints = expectedRobotsAgentHints.filter((agent) => !robotsText.includes(agent));
    if (!/^Sitemap:\s*\S+/im.test(robotsText)) {
        issues.push('robots.txt is missing a Sitemap directive.');
    }
    if (!/^User-agent:\s*\*/im.test(robotsText)) {
        issues.push('robots.txt is missing the wildcard User-agent block.');
    }
    if (missingAgentHints.length > 0) {
        issues.push(`robots.txt is missing expected AI crawler policy hints: ${missingAgentHints.join(', ')}.`);
    }

    return { hasRobots: true, userAgentCount };
}

function parseGeneratedHeaders(body) {
    const sources = [];
    for (const rawLine of `${body ?? ''}`.replace(/\r\n/g, '\n').split('\n')) {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !/^\s/.test(line)) {
            sources.push(trimmed);
        }
    }
    return sources;
}

async function inspectRetiredMarkdownSurface(publicRoot, issues) {
    const headersText = await readUtf8IfExists(path.join(publicRoot, '_headers'));
    const edgeoneText = await readUtf8IfExists(path.join(publicRoot, 'edgeone.json'));
    let generatedHeadersRoute = false;
    let edgeoneRoute = false;

    if (!headersText) {
        issues.push('Missing generated _headers.');
    } else {
        generatedHeadersRoute = parseGeneratedHeaders(headersText).includes('/*.md');
        if (generatedHeadersRoute) {
            issues.push('Generated _headers still contains the retired Markdown route /*.md.');
        }
    }

    if (!edgeoneText) {
        issues.push('Missing generated edgeone.json.');
    } else {
        try {
            const parsed = JSON.parse(edgeoneText);
            edgeoneRoute = Array.isArray(parsed.headers)
                && parsed.headers.some((entry) => entry?.source === '/*.md');
            if (edgeoneRoute) {
                issues.push('Generated edgeone.json still contains the retired Markdown route /*.md.');
            }
        } catch {
            issues.push('Generated edgeone.json is not valid JSON.');
        }
    }

    const markdownPaths = await collectFiles(
        publicRoot,
        (_absolutePath, name) => path.extname(name).toLowerCase() === '.md'
    );
    const generatedMarkdownFiles = markdownPaths
        .map((markdownPath) => toPublicRelativePath(publicRoot, markdownPath))
        .sort();
    if (generatedMarkdownFiles.length > 0) {
        issues.push(`Generated output still contains Markdown files: ${generatedMarkdownFiles.slice(0, 8).join(', ')}`);
    }

    return {
        edgeoneRoute,
        generatedHeadersRoute,
        generatedMarkdownFiles
    };
}

async function inspectLlmsFile({
    publicRoot,
    relativePath,
    canonicalOrigin,
    rootText,
    languageFile,
    issues
}) {
    const absolutePath = path.join(publicRoot, relativePath);
    const text = await fs.readFile(absolutePath, 'utf8');
    const localLinks = new Set();
    const markdownLinks = new Set();
    const fileCanonicalOrigin = extractCanonicalOrigin(text);

    if (!fileCanonicalOrigin) {
        issues.push(`${relativePath} is missing a parseable Canonical site URL.`);
    } else if (canonicalOrigin && fileCanonicalOrigin !== canonicalOrigin) {
        issues.push(`${relativePath} Canonical site origin differs from root llms.txt: ${fileCanonicalOrigin}`);
    }
    if (languageFile && rootText && text.trim() === rootText) {
        issues.push(`Language llms.txt duplicates the root llms.txt exactly: ${relativePath}`);
    }
    if (!/^## Agent Notes\b/m.test(text)) {
        issues.push(`${relativePath} is missing the Agent Notes section.`);
    }
    if (!/^- Canonical human-facing pages are HTML\.\s*$/m.test(text)) {
        issues.push(`${relativePath} does not declare canonical human-facing pages as HTML.`);
    }
    if (hasPerPageMirrorList(text)) {
        issues.push(`${relativePath} still contains a retired per-page Mirrors list.`);
    }
    if (languageFile) {
        if (!/^## Site Entry Points\b/m.test(text)) {
            issues.push(`${relativePath} is missing the Site Entry Points section.`);
        }
        if (!/^## Key Content Pages\b/m.test(text)) {
            issues.push(`${relativePath} is missing the Key Content Pages section.`);
        }
    } else if (!/^## Languages?\b/m.test(text) && !/^## Key Content Pages\b/m.test(text)) {
        issues.push(`${relativePath} is missing a Languages or Key Content Pages section.`);
    }

    for (const link of extractMarkdownLinks(text)) {
        if (isMarkdownTarget(link.target)) {
            markdownLinks.add(link.target);
            issues.push(`${relativePath} links to retired Markdown content: ${link.target}`);
        }

        const resolved = resolvePublicPathFromHref(link.target, {
            canonicalOrigin: canonicalOrigin || fileCanonicalOrigin,
            currentRelativePath: relativePath
        });
        if (resolved.kind === 'ignored' || resolved.kind === 'external') {
            continue;
        }
        if (resolved.kind === 'invalid') {
            issues.push(`${relativePath} contains an invalid link target: ${link.target}`);
            continue;
        }

        localLinks.add(resolved.relativePath);
        if (!await fileExists(path.join(publicRoot, resolved.relativePath))) {
            issues.push(`${relativePath} points to a missing local file: ${link.target} -> ${resolved.relativePath}`);
        }
    }

    const sitemapMatch = text.match(/^Sitemap:\s*(\S+)/mi);
    if (!sitemapMatch) {
        issues.push(`${relativePath} is missing a Sitemap line.`);
    } else {
        const resolved = resolvePublicPathFromHref(sitemapMatch[1], {
            canonicalOrigin: canonicalOrigin || fileCanonicalOrigin,
            currentRelativePath: relativePath
        });
        if (resolved.kind === 'local' && !await fileExists(path.join(publicRoot, resolved.relativePath))) {
            issues.push(`${relativePath} Sitemap points to a missing local file: ${resolved.relativePath}`);
        }
    }

    return {
        localLinks,
        markdownLinks,
        text
    };
}

async function inspectLlms(publicRoot, issues) {
    const rootPath = path.join(publicRoot, 'llms.txt');
    const rootText = await readUtf8IfExists(rootPath);
    if (!rootText) {
        issues.push('Missing root llms.txt.');
        return {
            hasLlms: false,
            canonicalOrigin: '',
            fileCount: 0,
            languageFiles: [],
            localLinkCount: 0,
            markdownLinkCount: 0
        };
    }

    const canonicalOrigin = extractCanonicalOrigin(rootText);
    const rootResult = await inspectLlmsFile({
        publicRoot,
        relativePath: 'llms.txt',
        canonicalOrigin,
        rootText: '',
        languageFile: false,
        issues
    });
    const llmsPaths = await collectFiles(
        publicRoot,
        (_absolutePath, name) => name.toLowerCase() === 'llms.txt'
    );
    const languageFiles = [];
    const localLinks = new Set(rootResult.localLinks);
    const markdownLinks = new Set(rootResult.markdownLinks);

    for (const llmsPath of llmsPaths) {
        const relativePath = toPublicRelativePath(publicRoot, llmsPath);
        if (relativePath === 'llms.txt') {
            continue;
        }

        languageFiles.push(relativePath);
        const result = await inspectLlmsFile({
            publicRoot,
            relativePath,
            canonicalOrigin,
            rootText: rootText.trim(),
            languageFile: true,
            issues
        });
        for (const link of result.localLinks) {
            localLinks.add(link);
        }
        for (const link of result.markdownLinks) {
            markdownLinks.add(link);
        }
    }

    return {
        hasLlms: true,
        canonicalOrigin,
        fileCount: llmsPaths.length,
        languageFiles: languageFiles.sort(),
        localLinkCount: localLinks.size,
        markdownLinkCount: markdownLinks.size
    };
}

async function inspectHtmlPublishingContract(publicRoot, canonicalOrigin, issues) {
    const htmlPaths = await collectFiles(
        publicRoot,
        (_absolutePath, name) => path.extname(name).toLowerCase() === '.html'
    );
    let markdownAlternates = 0;
    let localMarkdownLinks = 0;

    for (const htmlPath of htmlPaths) {
        const relativePath = toPublicRelativePath(publicRoot, htmlPath);
        const htmlText = await fs.readFile(htmlPath, 'utf8');

        for (const tag of extractStartTags(htmlText, 'link')) {
            if (hasRelToken(tag, 'alternate')
                && extractTagAttribute(tag, 'type').toLowerCase() === 'text/markdown') {
                markdownAlternates += 1;
                issues.push(`HTML page still advertises a Markdown alternate: ${relativePath}`);
            }
        }

        for (const tag of extractStartTags(htmlText, 'a')) {
            const href = extractTagAttribute(tag, 'href');
            if (!isMarkdownTarget(href)) {
                continue;
            }
            const resolved = resolvePublicPathFromHref(href, {
                canonicalOrigin,
                currentRelativePath: relativePath
            });
            if (resolved.kind === 'local') {
                localMarkdownLinks += 1;
                issues.push(`HTML page still links to retired local Markdown content: ${relativePath} -> ${href}`);
            }
        }
    }

    return {
        htmlCount: htmlPaths.length,
        markdownAlternates,
        localMarkdownLinks
    };
}

async function main() {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const publicRoot = path.resolve(siteRoot, options.publicDir);
    await fs.access(publicRoot);

    const issues = [];
    const source = await inspectSourceSettings(issues);
    const robots = await inspectRobots(publicRoot, issues);
    const retiredMarkdown = await inspectRetiredMarkdownSurface(publicRoot, issues);
    const llms = await inspectLlms(publicRoot, issues);
    const html = await inspectHtmlPublishingContract(publicRoot, llms.canonicalOrigin, issues);

    console.log('Agent readiness audit');
    console.log(`Root\t${publicRoot}`);
    console.log(`Mode\t${options.check ? 'report + check' : 'report only'}`);
    console.log(`robots.txt\t${robots.hasRobots ? 'yes' : 'no'}`);
    console.log(`robots user-agent blocks\t${robots.userAgentCount}`);
    console.log(`content Markdown source files\t${source.contentFiles}`);
    console.log(`agent-indexed content files\t${source.indexedContentFiles}`);
    console.log(`legacy Markdown output opt-ins\t${source.legacyMarkdownOptIns}`);
    console.log(`share_image configured\t${source.shareImageConfigured}`);
    console.log(`share_image inherited\t${source.shareImageInherited}`);
    console.log(`share_image disabled\t${source.shareImageDisabled}`);
    console.log(`llms.txt\t${llms.hasLlms ? 'yes' : 'no'}`);
    console.log(`llms.txt files\t${llms.fileCount}`);
    console.log(`language llms.txt files\t${llms.languageFiles.length}`);
    if (llms.languageFiles.length > 0) {
        console.log(`language llms.txt paths\t${llms.languageFiles.join(', ')}`);
    }
    console.log(`Canonical origin\t${llms.canonicalOrigin || '<missing>'}`);
    console.log(`llms local links\t${llms.localLinkCount}`);
    console.log(`llms Markdown links\t${llms.markdownLinkCount}`);
    console.log(`HTML files\t${html.htmlCount}`);
    console.log(`HTML Markdown alternates\t${html.markdownAlternates}`);
    console.log(`HTML local Markdown links\t${html.localMarkdownLinks}`);
    console.log(`generated Markdown files\t${retiredMarkdown.generatedMarkdownFiles.length}`);
    console.log(`retired Markdown route (_headers)\t${retiredMarkdown.generatedHeadersRoute ? 'yes' : 'no'}`);
    console.log(`retired Markdown route (edgeone.json)\t${retiredMarkdown.edgeoneRoute ? 'yes' : 'no'}`);

    if (issues.length > 0) {
        console.log('\nAgent readiness issues');
        for (const issue of issues) {
            console.log(`- ${issue}`);
        }
        if (options.check) {
            process.exit(1);
        }
        return;
    }

    console.log('\nAgent readiness audit passed.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
