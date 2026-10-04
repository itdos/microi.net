import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDarwinAvailableMemory, readAvailableMemory } from '../scripts/available-memory.mjs';
import { calculateBuildMemoryPlan } from '../scripts/build-memory-plan.mjs';

const gb = 1024 ** 3;
const vm = (pageSize, free, files) => `Mach Virtual Memory Statistics: (page size of ${pageSize} bytes)
Pages free: ${free}.
Pages inactive: 9000000.
Pages speculative: 100000.
Pages wired down: 4000000.
Pages occupied by compressor: 4000000.
File-backed pages: ${files}.
`;

test('macOS file cache can satisfy the unchanged build budget without double-counting other pages', () => {
    const available = parseDarwinAvailableMemory(vm(4096, 256 * 1024, 5 * 1024 * 1024), 64 * gb);
    const plan = calculateBuildMemoryPlan({ totalMemory: 64 * gb, heapLimitMb: 6144, processTreePeakMb: 6144 });
    assert.equal(available, 21 * gb);
    assert(available >= plan.requiredStartMemory);
    assert(1 * gb < plan.requiredStartMemory);
});

test('Apple Silicon page size and genuine low memory retain the pause threshold', () => {
    const available = parseDarwinAvailableMemory(vm(16384, 16384, 16384), 16 * gb);
    assert.equal(available, 0.5 * gb);
    assert(1 - available / (16 * gb) >= 0.95);
});

test('missing, negative and impossible statistics cannot increase available memory', () => {
    for (const output of ['', vm(0, 1, 1), vm(4096, -1, 1), vm(4096, 2 ** 52, 1), vm(4096, 1, 1).replace('File-backed pages:', 'Unknown pages:')]) {
        assert.throws(() => parseDarwinAvailableMemory(output, 16 * gb));
    }
});

test('a failed or malformed bounded macOS probe falls back to native free memory', () => {
    for (const result of [{ status: 1 }, { status: null, error: new Error('timeout') }, { status: 0, stdout: 'unexpected' }]) {
        assert.equal(readAvailableMemory({ platform: 'darwin', totalMemory: 16 * gb, freeMemory: 0.25 * gb, run: () => result }), 0.25 * gb);
    }
});

test('macOS probe uses a fixed executable and bounded timeout; other platforms keep the native reading', () => {
    const available = readAvailableMemory({ platform: 'darwin', totalMemory: 16 * gb, freeMemory: 1, run: (command, args, options) => {
        assert.equal(command, '/usr/bin/vm_stat'); assert.deepEqual(args, []);
        assert.equal(options.timeout, 1500); assert.equal(options.maxBuffer, 64 * 1024);
        return { status: 0, stdout: vm(4096, 1, 2) };
    } });
    assert.equal(available, 3 * 4096);
    for (const platform of ['win32', 'linux']) {
        assert.equal(readAvailableMemory({ platform, freeMemory: 123, run: () => { throw new Error('must not probe macOS'); } }), 123);
    }
});
