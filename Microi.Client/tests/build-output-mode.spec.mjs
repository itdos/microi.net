import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    legacyStartMarker,
    resolveBuildOutputMode,
    validateBuildOutputMode
} from '../scripts/build-output-mode.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, '..');
const workspaceDir = path.resolve(projectDir, '..');

test('默认构建只生成现代版，legacy 必须显式启用', () => {
    const modern = resolveBuildOutputMode([]);
    assert.equal(modern.mode, 'modern-only');
    assert.equal(modern.runModern, true);
    assert.equal(modern.includeLegacy, false);
    assert.deepEqual(modern.viteArgs, ['build']);

    const combined = resolveBuildOutputMode(['--with-legacy', '--force']);
    assert.equal(combined.mode, 'modern-and-legacy');
    assert.equal(combined.runModern, true);
    assert.equal(combined.includeLegacy, true);
    assert.deepEqual(combined.viteArgs, ['build', '--force']);

    const legacyOnly = resolveBuildOutputMode(['--legacy-only', '--dry-run']);
    assert.equal(legacyOnly.mode, 'legacy-only');
    assert.equal(legacyOnly.runModern, false);
    assert.equal(legacyOnly.includeLegacy, true);
    assert.equal(legacyOnly.dryRun, true);
    assert.deepEqual(legacyOnly.viteArgs, ['build']);
});

test('产物校验阻止现代版混入旧 legacy 文件', () => {
    const tempRoot = path.join(projectDir, '.tmp');
    mkdirSync(tempRoot, { recursive: true });
    const distDir = mkdtempSync(path.join(tempRoot, 'build-output-mode-test-'));

    try {
        writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><body>modern</body>', 'utf8');
        assert.deepEqual(validateBuildOutputMode({ distDir, includeLegacy: false }), {
            hasLegacyDirectory: false,
            hasLegacyMarker: false
        });
        assert.throws(
            () => validateBuildOutputMode({ distDir, includeLegacy: true }),
            /legacy.*缺失/
        );

        mkdirSync(path.join(distDir, 'static', 'js-legacy'), { recursive: true });
        writeFileSync(
            path.join(distDir, 'index.html'),
            `<!doctype html><body>${legacyStartMarker}</body>`,
            'utf8'
        );
        assert.deepEqual(validateBuildOutputMode({ distDir, includeLegacy: true }), {
            hasLegacyDirectory: true,
            hasLegacyMarker: true
        });
        assert.throws(
            () => validateBuildOutputMode({ distDir, includeLegacy: false }),
            /残留的 Chrome 49 legacy/
        );
    } finally {
        rmSync(distDir, { recursive: true, force: true });
    }
});

test('package 与一键发布入口保持现代版默认契约', () => {
    const packageJson = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    assert.equal(packageJson.scripts.build, 'node scripts/build-with-memory-guard.mjs');
    assert.equal(
        packageJson.scripts['build:legacy'],
        'node scripts/build-with-memory-guard.mjs --with-legacy'
    );
    assert.deepEqual(packageJson.browserslist, [
        'Chrome >= 107',
        'Edge >= 107',
        'Firefox >= 104',
        'Safari >= 16'
    ]);

    const releaseScript = readFileSync(
        path.join(workspaceDir, 'Microi一键编译发布.sh'),
        'utf8'
    );
    assert.match(releaseScript, /BUILD_CLIENT_LEGACY=false/);
    assert.match(releaseScript, /MICROI_BUILD_CHROME49_LEGACY/);
    assert.match(releaseScript, /_build_args\+=\(--with-legacy\)/);
    assert.match(releaseScript, /read -r -p .*_legacy_choice \|\| _legacy_choice=""/);
    assert.ok(
        releaseScript.indexOf('# --- Chrome 49 兼容产物') >
            releaseScript.indexOf('# --- 官方网站文档发布选项'),
        'legacy 提示应追加在现有发布问题之后，避免改变旧自动化输入顺序'
    );
});

test('构建守护器 dry-run 能区分默认与可选 legacy 模式', () => {
    const runDry = (args) => spawnSync(
        process.execPath,
        ['scripts/build-with-memory-guard.mjs', '--dry-run', ...args],
        {
            cwd: projectDir,
            encoding: 'utf8',
            env: {
                ...process.env,
                MICROI_BUILD_SKIP_MEMORY_WAIT: '1'
            }
        }
    );

    const modern = runDry([]);
    assert.equal(modern.status, 0, modern.stderr || modern.stdout);
    assert.match(modern.stdout, /本次构建模式：仅现代版/);
    assert.match(modern.stdout, /Chrome 49 legacy 未启用/);

    const combined = runDry(['--with-legacy']);
    assert.equal(combined.status, 0, combined.stderr || combined.stdout);
    assert.match(combined.stdout, /本次构建模式：现代版 \+ Chrome 49 legacy/);
});
