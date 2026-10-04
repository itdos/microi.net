import { spawnSync } from 'node:child_process';
import os from 'node:os';

export function parseDarwinAvailableMemory(output, totalMemory) {
    const pageSize = Number(/page size of (\d+) bytes/.exec(output)?.[1]);
    const freePages = Number(/^Pages free:\s+(\d+)\./m.exec(output)?.[1]);
    const filePages = Number(/^File-backed pages:\s+(\d+)\./m.exec(output)?.[1]);
    const values = [pageSize, freePages, filePages, totalMemory];
    if (!values.every(Number.isSafeInteger) || pageSize <= 0 || totalMemory <= 0 ||
        freePages < 0 || filePages < 0) throw new Error('Invalid macOS memory statistics.');
    const available = (freePages + filePages) * pageSize;
    if (!Number.isSafeInteger(available) || available > totalMemory) {
        throw new Error('macOS memory statistics exceed physical memory.');
    }
    // Conservative fully reclaimable subset; do not count inactive anonymous,
    // wired or compressed pages, and do not add speculative pages twice.
    // https://github.com/apple-oss-distributions/xnu/blob/main/doc/vm/memorystatus_notify.md
    return available;
}

export function readAvailableMemory({
    platform = process.platform,
    totalMemory = os.totalmem(),
    freeMemory = os.freemem(),
    run = spawnSync
} = {}) {
    if (platform !== 'darwin') return freeMemory;
    try {
        const result = run('/usr/bin/vm_stat', [], {
            encoding: 'utf8', timeout: 1500, maxBuffer: 64 * 1024,
            env: { ...process.env, LC_ALL: 'C' }
        });
        if (result.error || result.status !== 0) return freeMemory;
        return parseDarwinAvailableMemory(result.stdout, totalMemory);
    } catch {
        // Unknown output or an unavailable probe keeps the original conservative gate.
        return freeMemory;
    }
}
