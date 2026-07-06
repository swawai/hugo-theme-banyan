import fs from 'node:fs';
import path from 'node:path';

export function resolveHugoCommand({ cwd = process.cwd() } = {}) {
    const localBinName = process.platform === 'win32' ? 'hugo.exe' : 'hugo';
    const localHugo = path.join(cwd, 'node_modules', '.bin', localBinName);
    if (fs.existsSync(localHugo)) {
        return localHugo;
    }

    return process.platform === 'win32' ? 'hugo.exe' : 'hugo';
}
