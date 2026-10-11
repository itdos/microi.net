import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { calculateBuildMemoryPlan } from '../scripts/build-memory-plan.mjs';
import {
    createModernPostMinifyFingerprintPlugin,
    modernBuildTargets,
    modernMinifyPipelineVersion
} from '../scripts/modern-build-pipeline.mjs';
import { minifyModernOutput, renameMinifiedOutput } from '../scripts/minify-modern-output.mjs';

const GB = 1024 ** 3;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, '..');
const tempRoot = path.join(projectDir, '.tmp');

const memory32 = calculateBuildMemoryPlan({
    totalMemory: 31.9 * GB,
    heapLimitMb: 6144,
    processTreePeakMb: 6144
});
assert.equal((memory32.systemSafetyMemory / GB).toFixed(1), '1.6');
assert.equal((memory32.requiredStartMemory / GB).toFixed(1), '7.6');

const memory64 = calculateBuildMemoryPlan({
    totalMemory: 64 * GB,
    heapLimitMb: 6144,
    processTreePeakMb: 6144
});
assert.equal((memory64.systemSafetyMemory / GB).toFixed(1), '3.2');
assert.equal((memory64.requiredStartMemory / GB).toFixed(1), '9.2');
assert.ok(memory64.requiredStartMemory < 12.8 * GB, '64 GB 主机不应再被固定 20% 门槛拦截');

const fingerprintPlugin = createModernPostMinifyFingerprintPlugin();
assert.equal(fingerprintPlugin.augmentChunkHash(), modernMinifyPipelineVersion);
assert.deepEqual(modernBuildTargets, ['chrome107', 'edge107', 'firefox104', 'safari16']);
assert.equal(fingerprintPlugin.renderChunk, undefined, '压缩不得再驻留在 Rollup renderChunk 生命周期内');

await mkdir(tempRoot, { recursive: true });
const workspaceDir = await mkdtemp(path.join(tempRoot, 'modern-minify-test-'));
const distDir = path.join(workspaceDir, 'dist');
const publicDir = path.join(workspaceDir, 'public');
try {
    const modernDir = path.join(distDir, 'static', 'js');
    const legacyDir = path.join(distDir, 'static', 'js-legacy');
    const publicScriptDir = path.join(publicDir, 'static', 'js');
    await mkdir(modernDir, { recursive: true });
    await mkdir(legacyDir, { recursive: true });
    await mkdir(publicScriptDir, { recursive: true });

    const modernPath = path.join(modernDir, 'app.js');
    const classicPath = path.join(modernDir, 'microi.loading.js');
    const legacyPath = path.join(legacyDir, 'legacy.js');
    const source = 'const value = 1 + 2; console.log(value); export { value };';
    const classicSource = await readFile(
        path.join(projectDir, 'public', 'static', 'js', 'microi.loading.js'),
        'utf8'
    );
    const legacySource = 'console.log("legacy must stay unchanged");';
    await writeFile(modernPath, source, 'utf8');
    await writeFile(classicPath, classicSource, 'utf8');
    await writeFile(path.join(publicScriptDir, 'microi.loading.js'), classicSource, 'utf8');
    await writeFile(legacyPath, legacySource, 'utf8');

    const progress = [];
    const result = await minifyModernOutput({
        distDir,
        publicDir,
        onProgress(item) {
            progress.push(item);
        }
    });
    const modernOutput = await readFile(modernPath, 'utf8');
    const classicOutput = await readFile(classicPath, 'utf8');
    const legacyOutput = await readFile(legacyPath, 'utf8');

    assert.equal(result.fileCount, 2);
    assert.equal(result.moduleFileCount, 1);
    assert.equal(result.classicScriptFileCount, 1);
    assert.equal(progress.length, 2);
    assert.doesNotMatch(modernOutput, /console/);
    assert.match(modernOutput, /export/);
    assert.ok(modernOutput.length < source.length);
    assert.doesNotMatch(classicOutput, /\bexport\s+(?:default|\{|const|let|var|function|class|\*)/);
    assert.doesNotMatch(classicOutput, /console/);
    assert.match(classicOutput, /function LoadRate\b/);
    const classicContext = {
        window: null,
        document: {
            getElementById() { return null; },
            querySelector() { return null; }
        },
        navigator: { userAgent: '' },
        setInterval() { return 1; },
        clearInterval() {},
        setTimeout() { return 1; },
        requestAnimationFrame() { return 1; },
        alert() {}
    };
    classicContext.window = classicContext;
    classicContext.addEventListener = () => {};
    vm.runInNewContext(classicOutput, classicContext);
    assert.equal(typeof classicContext.LoadRate, 'function');
    assert.equal(typeof classicContext.window.LoadRate, 'function');
    assert.equal(legacyOutput, legacySource);

    const retryTarget = path.join(workspaceDir, 'rename-target.js');
    const retryTemporary = `${retryTarget}.tmp`;
    await writeFile(retryTarget, 'old output', 'utf8');
    await writeFile(retryTemporary, 'new output', 'utf8');
    let retryAttempts = 0;
    const retryWaits = [];
    await renameMinifiedOutput(retryTemporary, retryTarget, {
        platform: 'win32',
        renameFile: async (...args) => {
            retryAttempts += 1;
            if (retryAttempts < 3) {
                const error = new Error('simulated temporary Windows file lock');
                error.code = retryAttempts === 1 ? 'EPERM' : 'EBUSY';
                throw error;
            }
            await rename(...args);
        },
        wait: async (delayMs) => { retryWaits.push(delayMs); await sleep(delayMs); }
    });
    assert.equal(retryAttempts, 3);
    assert.deepEqual(retryWaits, [40, 80]);
    assert.equal(await readFile(retryTarget, 'utf8'), 'new output');

    const persistentTarget = path.join(workspaceDir, 'persistent-target.js');
    const persistentTemporary = `${persistentTarget}.tmp`;
    await writeFile(persistentTarget, 'original output', 'utf8');
    await writeFile(persistentTemporary, 'unpublished output', 'utf8');
    const persistentError = new Error('simulated persistent Windows file lock');
    persistentError.code = 'EPERM';
    let persistentAttempts = 0;
    const persistentWaits = [];
    await assert.rejects(
        renameMinifiedOutput(persistentTemporary, persistentTarget, {
            platform: 'win32',
            renameFile: async () => { persistentAttempts += 1; throw persistentError; },
            wait: async (delayMs) => { persistentWaits.push(delayMs); }
        }),
        (error) => error === persistentError
    );
    assert.equal(persistentAttempts, 6);
    assert.equal(persistentWaits.length, 5);
    assert.equal(await readFile(persistentTarget, 'utf8'), 'original output');
    assert.equal(await readFile(persistentTemporary, 'utf8'), 'unpublished output');

    for (const [platform, code] of [['linux', 'EPERM'], ['win32', 'EIO']]) {
        let attempts = 0;
        const unexpectedError = new Error('non-retryable rename failure');
        unexpectedError.code = code;
        await assert.rejects(
            renameMinifiedOutput('source', 'target', {
                platform,
                renameFile: async () => { attempts += 1; throw unexpectedError; },
                wait: async () => { throw new Error('must not wait'); }
            }),
            (error) => error === unexpectedError
        );
        assert.equal(attempts, 1);
    }
} finally {
    await rm(workspaceDir, { recursive: true, force: true });
}

console.log('PASS modern output minify tests');
