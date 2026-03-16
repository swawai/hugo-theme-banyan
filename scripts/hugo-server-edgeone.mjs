import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.cwd();
const publicEdgeonePath = path.join(repoRoot, 'public', 'edgeone.json');
const repoEdgeonePath = path.join(repoRoot, 'edgeone.json');
const hugoBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'hugo.cmd' : 'hugo'
);
const hugoArgs = ['server', ...process.argv.slice(2)];

async function syncEdgeone() {
    let publicBody = '';
    let repoBody = '';

    try {
        publicBody = await fs.readFile(publicEdgeonePath, 'utf8');
    } catch (error) {
        if (!error || error.code !== 'ENOENT') {
            throw error;
        }
        return;
    }

    try {
        repoBody = await fs.readFile(repoEdgeonePath, 'utf8');
    } catch (error) {
        if (!error || error.code !== 'ENOENT') {
            throw error;
        }
    }

    if (publicBody === repoBody) {
        return;
    }

    await fs.writeFile(repoEdgeonePath, publicBody, 'utf8');
    console.log('[edgeone-sync] Synced public/edgeone.json -> edgeone.json');
}

const child = spawn(hugoBin, hugoArgs, {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit'
});

let syncInFlight = false;
let syncQueued = false;

async function runSyncLoop() {
    if (syncInFlight) {
        syncQueued = true;
        return;
    }

    syncInFlight = true;
    try {
        await syncEdgeone();
    } catch (error) {
        console.error('[edgeone-sync]', error instanceof Error ? error.message : String(error));
    } finally {
        syncInFlight = false;
        if (syncQueued) {
            syncQueued = false;
            void runSyncLoop();
        }
    }
}

const interval = setInterval(() => {
    void runSyncLoop();
}, 1000);

child.on('exit', (code, signal) => {
    clearInterval(interval);
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});

child.on('error', (error) => {
    clearInterval(interval);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});

process.on('SIGINT', () => {
    clearInterval(interval);
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    clearInterval(interval);
    child.kill('SIGTERM');
});

void runSyncLoop();
