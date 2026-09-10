import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(clientRoot, '..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

async function reservePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function waitForPort(port, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const connected = await new Promise(resolve => {
            const socket = net.connect({ host: '127.0.0.1', port });
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('error', () => resolve(false));
        });
        if (connected) return;
        await delay(100);
    }
    throw new Error(`等待端口 ${port} 超时`);
}

async function waitForExit(child, timeoutMs = 10000) {
    if (child.exitCode !== null || child.signalCode !== null) return true;
    return Promise.race([
        once(child, 'exit').then(() => true),
        delay(timeoutMs).then(() => false)
    ]);
}

const fixtureParent = path.join(repoRoot, '.tmp');
const ownedFixtures = new Set();

function createFixture() {
    fs.mkdirSync(fixtureParent, { recursive: true });
    const root = fs.mkdtempSync(path.join(fixtureParent, 'microi-process-lifecycle-'));
    ownedFixtures.add(root);
    return root;
}

function removeFixture(root) {
    assert.ok(ownedFixtures.has(root), '只能回收本用例创建的目录');
    assert.equal(path.dirname(path.resolve(root)), path.resolve(fixtureParent));
    assert.ok(path.basename(root).startsWith('microi-process-lifecycle-'));
    fs.rmSync(root, { recursive: true, force: true });
    ownedFixtures.delete(root);
}

function runProcessManager(workspaceRoot, action, frontendPort, backendPort = 61501) {
    // StopBackend 会同时清理所选工作区的 Release 进程；测试绝不能指向真实源码工作区。
    assert.notEqual(path.resolve(workspaceRoot), repoRoot);
    assert.ok(path.resolve(workspaceRoot).startsWith(path.resolve(fixtureParent) + path.sep));
    return spawnSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', path.join(repoRoot, 'Microi.Server', 'tools', 'Microi.LocalProcessManager.ps1'),
        '-Action', action,
        '-WorkspaceRoot', workspaceRoot,
        '-BackendPort', String(backendPort),
        '-FrontendPort', String(frontendPort)
    ], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000
    });
}

function stopExactProcessTree(child) {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
    });
}

test('一键发布先取得工作区互斥锁并调用精确进程管理器', () => {
    const script = read('Microi一键编译发布.sh');

    assert.match(script, /acquire_workspace_lock/);
    assert.match(script, /microi-process-state/);
    assert.match(script, /release\.lock/);
    assert.match(script, /Microi\.LocalProcessManager\.ps1/);
    assert.match(script, /-Action PrepareRelease/);
    assert.match(script, /release_workspace_lock/);
    assert.match(script, /UseSharedCompilation=false/);
    assert.doesNotMatch(script, /taskkill[^\n]*\/IM\s+(dotnet|node|chrome|msedge|VBCSCompiler)/i);
});

test('Windows 进程管理器按端口、进程类型和工作区路径校验并复核 DLL 文件锁', () => {
    const manager = read('Microi.Server/tools/Microi.LocalProcessManager.ps1');

    assert.match(manager, /Test-IsWorkspaceBackend/);
    assert.match(manager, /Test-IsWorkspaceFrontend/);
    assert.match(manager, /NativeProcessInspector/);
    assert.match(manager, /Get-ProcessCurrentDirectory/);
    assert.match(manager, /return \(Get-ProcessCurrentDirectory \$ProcessInfo\) -eq \$backendRoot/);
    assert.match(manager, /return \(Get-ProcessCurrentDirectory \$ProcessInfo\) -eq \$frontendRoot/);
    assert.match(manager, /processName -ne 'dotnet\.exe'/);
    assert.match(manager, /processName -ne 'node\.exe'/);
    assert.match(manager, /端口 \$Port 被非当前工作区的进程占用，拒绝自动结束/);
    assert.match(manager, /\[System\.IO\.FileShare\]::None/);
    assert.match(manager, /taskkill\.exe \/PID \$processId \/T \/F/);
    assert.doesNotMatch(manager, /\/IM\s+(dotnet|node|chrome|msedge)/i);
});

test('临时输出的 Microi.net.Api 仅在 CWD 精确属于当前工作区时可结束', {
    skip: process.platform !== 'win32'
}, async () => {
    const testRoot = createFixture();
    const workspaceRoot = path.join(testRoot, 'workspace');
    const backendRoot = path.join(workspaceRoot, 'Microi.Server', 'Microi.net.Api');
    fs.mkdirSync(backendRoot, { recursive: true });
    const fakeBackend = path.join(testRoot, 'Microi.net.Api.exe');
    const listener = path.join(testRoot, 'listener.cjs');
    fs.copyFileSync(process.execPath, fakeBackend);
    fs.writeFileSync(listener, [
        "const net = require('node:net');",
        "net.createServer(() => {}).listen(Number(process.argv[2]), '127.0.0.1');"
    ].join('\n'));

    let workspaceBackend;
    let externalBackend;
    let otherReleaseBackend;
    let externalRoot;
    try {
        // 同时运行另一个工作区的 Release 形态进程，证明清理范围不会越过夹具边界。
        const otherBackendRoot = path.join(testRoot, 'other-workspace', 'Microi.Server', 'Microi.net.Api');
        const otherReleasePath = path.join(otherBackendRoot, 'bin', 'Release', 'Microi.net.Api.exe');
        fs.mkdirSync(path.dirname(otherReleasePath), { recursive: true });
        fs.copyFileSync(process.execPath, otherReleasePath);
        const otherReleasePort = await reservePort();
        otherReleaseBackend = spawn(otherReleasePath, [listener, String(otherReleasePort)], {
            cwd: otherBackendRoot, windowsHide: true, stdio: 'ignore'
        });
        await waitForPort(otherReleasePort);
        const workspacePort = await reservePort();
        workspaceBackend = spawn(fakeBackend, [listener, String(workspacePort)], {
            cwd: backendRoot,
            windowsHide: true,
            stdio: 'ignore'
        });
        await waitForPort(workspacePort);

        const workspaceResult = runProcessManager(workspaceRoot, 'StopBackend', 61500, workspacePort);
        assert.equal(
            workspaceResult.status,
            0,
            `${workspaceResult.stdout}\n${workspaceResult.stderr}`
        );
        assert.equal(await waitForExit(workspaceBackend), true, '当前工作区 CWD 的临时后端应被精确结束');
        assert.equal(otherReleaseBackend.exitCode, null, '另一个工作区的 Release 后端必须保持运行');
        await waitForPort(otherReleasePort);

        externalRoot = path.join(testRoot, 'external-backend');
        fs.mkdirSync(externalRoot);
        const externalPort = await reservePort();
        externalBackend = spawn(fakeBackend, [listener, String(externalPort)], {
            cwd: externalRoot,
            windowsHide: true,
            stdio: 'ignore'
        });
        await waitForPort(externalPort);

        const externalResult = runProcessManager(workspaceRoot, 'StopBackend', 61500, externalPort);
        assert.notEqual(externalResult.status, 0, '外部 CWD 的同名临时后端必须拒绝结束');
        assert.equal(externalBackend.exitCode, null, '拒绝后外部临时后端必须继续运行');
    }
    finally {
        stopExactProcessTree(workspaceBackend);
        stopExactProcessTree(externalBackend);
        stopExactProcessTree(otherReleaseBackend);
        if (workspaceBackend) await waitForExit(workspaceBackend, 5000);
        if (externalBackend) await waitForExit(externalBackend, 5000);
        if (otherReleaseBackend) await waitForExit(otherReleaseBackend, 5000);
        removeFixture(testRoot);
    }
});

test('相对入口 Vite 用进程工作目录识别当前工作区，并对外部工作区失败关闭', {
    skip: process.platform !== 'win32'
}, async () => {
    const viteEntry = path.join('node_modules', 'vite', 'bin', 'vite.js');
    assert.equal(fs.existsSync(path.join(clientRoot, viteEntry)), true, 'Microi.Client 必须已安装 Vite');
    const testRoot = createFixture();
    const workspaceRoot = path.join(testRoot, 'workspace');
    const frontendRoot = path.join(workspaceRoot, 'Microi.Client');
    const fixtureEntry = path.join(frontendRoot, viteEntry);
    fs.mkdirSync(path.dirname(fixtureEntry), { recursive: true });
    // 仍运行项目安装的真实 Vite，只把相对入口、CWD 与页面放入独立工作区。
    fs.writeFileSync(path.join(frontendRoot, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.writeFileSync(path.join(frontendRoot, 'index.html'), '<!doctype html><title>Process lifecycle fixture</title>');
    fs.writeFileSync(fixtureEntry, `import ${JSON.stringify(pathToFileURL(path.join(clientRoot, viteEntry)).href)};`);

    let workspaceVite;
    let externalVite;
    let externalRoot;
    try {
        const workspacePort = await reservePort();
        workspaceVite = spawn(process.execPath, [
            viteEntry,
            '--host', '127.0.0.1',
            '--port', String(workspacePort),
            '--strictPort'
        ], {
            cwd: frontendRoot,
            windowsHide: true,
            stdio: 'ignore'
        });
        await waitForPort(workspacePort);

        const workspaceResult = runProcessManager(workspaceRoot, 'StopFrontend', workspacePort);
        assert.equal(
            workspaceResult.status,
            0,
            `${workspaceResult.stdout}\n${workspaceResult.stderr}`
        );
        assert.equal(await waitForExit(workspaceVite), true, '当前工作区相对入口 Vite 应被精确结束');

        externalRoot = path.join(testRoot, 'external-vite');
        const fakeVitePath = path.join(externalRoot, viteEntry);
        fs.mkdirSync(path.dirname(fakeVitePath), { recursive: true });
        fs.writeFileSync(fakeVitePath, [
            "const net = require('node:net');",
            "const index = process.argv.indexOf('--port');",
            "const port = Number(process.argv[index + 1]);",
            "net.createServer(() => {}).listen(port, '127.0.0.1');"
        ].join('\n'));

        const externalPort = await reservePort();
        externalVite = spawn(process.execPath, [
            viteEntry,
            '--host', '127.0.0.1',
            '--port', String(externalPort)
        ], {
            cwd: externalRoot,
            windowsHide: true,
            stdio: 'ignore'
        });
        await waitForPort(externalPort);

        const externalResult = runProcessManager(workspaceRoot, 'StopFrontend', externalPort);
        assert.notEqual(externalResult.status, 0, '外部工作区相对入口 Vite 必须拒绝结束');
        assert.equal(externalVite.exitCode, null, '拒绝后外部 Vite 必须继续运行');
    }
    finally {
        stopExactProcessTree(workspaceVite);
        stopExactProcessTree(externalVite);
        if (workspaceVite) await waitForExit(workspaceVite, 5000);
        if (externalVite) await waitForExit(externalVite, 5000);
        removeFixture(testRoot);
    }
});

test('自动化启动器阻止发布期间抢端口、只使用 Debug，并结束完整后端进程树', () => {
    const runner = read('Microi.Client/scripts/run-form-engine-freeze-trace.mjs');

    assert.match(runner, /releaseLockPath/);
    assert.match(runner, /assertReleaseIsNotRunning/);
    assert.match(runner, /PW_BACKEND_CONFIGURATION \|\| 'Debug'/);
    assert.match(runner, /PW_BACKEND_CONFIGURATION=Release is forbidden/);
    assert.match(runner, /taskkill\.exe', \['\/PID', String\(child\.pid\), '\/T', '\/F'\]/);
    assert.match(runner, /stopManagedProcessTree\(backendProcess, 'backend'\)/);
    assert.doesNotMatch(runner, /backendProcess\.kill\(\)/);
});

test('DLL 被占用时报告原始路径与占用错误，不因 catch 中的错误对象丢失文件路径', {
    skip: process.platform !== 'win32'
}, () => {
    const testRoot = createFixture();
    try {
        const dll = path.join(testRoot, 'held.dll');
        fs.writeFileSync(dll, 'owned lock fixture');
        const manager = read('Microi.Server/tools/Microi.LocalProcessManager.ps1');
        const fn = manager.slice(manager.indexOf('function Get-LockedReleaseFiles {'), manager.indexOf('function Assert-ReleaseFilesUnlocked {'));
        const quote = value => "'" + value.replaceAll("'", "''") + "'";
        const script = path.join(testRoot, 'locked-file.ps1');
        fs.writeFileSync(script, '\uFEFF' + [
            'Set-StrictMode -Version Latest', "$ErrorActionPreference = 'Stop'",
            '$releaseOutput = ' + quote(testRoot), fn,
            '$held = [System.IO.File]::Open(' + quote(dll) + ', [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)',
            'try {',
            '  $locked = @(Get-LockedReleaseFiles)',
            '  if ($locked.Count -ne 1) { throw "Expected exactly one locked file" }',
            '  if ($locked[0].Path -ne ' + quote(dll) + ') { throw "Original path was lost" }',
            '  if ([string]::IsNullOrWhiteSpace($locked[0].Error)) { throw "Original lock error was lost" }',
            '} finally { $held.Dispose() }'
        ].join('\n'));
        const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { cwd: testRoot, windowsHide: true, encoding: 'utf8', timeout: 15000 });
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
        removeFixture(testRoot);
    }
});
