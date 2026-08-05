import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { calculateBuildMemoryPlan } from '../scripts/build-memory-plan.mjs';
import {
    createModernPostMinifyFingerprintPlugin,
    modernBuildTargets,
    modernMinifyPipelineVersion
} from '../scripts/modern-build-pipeline.mjs';
import { minifyModernOutput } from '../scripts/minify-modern-output.mjs';

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
} finally {
    await rm(workspaceDir, { recursive: true, force: true });
}

console.log('PASS modern output minify tests: 16/16');
