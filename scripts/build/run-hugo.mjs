import { spawn } from 'node:child_process';

import { createHugoEnv } from './hugo-env.mjs';
import { resolveHugoCommand } from './hugo-command.mjs';

const siteRoot = process.cwd();
const hugoCommand = resolveHugoCommand({ cwd: siteRoot });

const child = spawn(hugoCommand, process.argv.slice(2), {
    cwd: siteRoot,
    env: createHugoEnv({ cwd: siteRoot }),
    shell: false,
    stdio: 'inherit'
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});

child.on('error', (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
