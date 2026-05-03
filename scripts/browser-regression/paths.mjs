import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
export const publicDir = path.join(repoRoot, 'public');
export const tempPublicRoot = path.join(repoRoot, 'temp_workspace', 'public');
export const regressionRoot = path.join(repoRoot, 'temp_workspace', 'regression');

function hasIndexHtml(dirPath) {
    return fs.existsSync(path.join(dirPath, 'index.html'));
}

function listDirectories(rootDir) {
    if (!fs.existsSync(rootDir)) return [];
    return fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootDir, entry.name));
}

function sortByMtimeDesc(paths) {
    return paths
        .map((dirPath) => ({
            dirPath,
            mtimeMs: fs.statSync(dirPath).mtimeMs
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map((item) => item.dirPath);
}

export function relFromRepo(absPath) {
    return path.relative(repoRoot, absPath).replace(/\\/g, '/');
}

export function resolvePrimaryBuildDir() {
    const latestTempBuild = sortByMtimeDesc(
        listDirectories(tempPublicRoot).filter(hasIndexHtml)
    )[0];
    if (latestTempBuild) {
        return latestTempBuild;
    }

    if (hasIndexHtml(publicDir)) {
        return publicDir;
    }

    throw new Error('No browser-regression build root found. Expected public/index.html or a temp_workspace/public/<build>/index.html.');
}

export function resolveUpgradeBuildPair() {
    const buildDirs = sortByMtimeDesc(
        listDirectories(tempPublicRoot).filter(hasIndexHtml)
    );
    if (buildDirs.length < 2) return null;

    return {
        fromDir: buildDirs[1],
        toDir: buildDirs[0]
    };
}

function pad(value) {
    return String(value).padStart(2, '0');
}

function timestampId(date = new Date()) {
    return [
        String(date.getFullYear()).slice(-2),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}

export function createOutputDir(modeName) {
    const dirPath = path.join(regressionRoot, `${timestampId()}-${modeName}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}
