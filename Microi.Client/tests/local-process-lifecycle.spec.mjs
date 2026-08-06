import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

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

function runProcessManager(action, frontendPort) {
    return spawnSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', path.join(repoRoot, 'Microi.Server', 'tools', 'Microi.LocalProcessManager.ps1'),
        '-Action', action,
        '-WorkspaceRoot', repoRoot,
        '-FrontendPort', String(frontendPort)
    ], {
        cwd: repoRoot,
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
    assert.match(manager, /return \(Get-ProcessCurrentDirectory \$ProcessInfo\) -eq \$frontendRoot/);
    assert.match(manager, /processName -ne 'dotnet\.exe'/);
    assert.match(manager, /processName -ne 'node\.exe'/);
    assert.match(manager, /端口 \$Port 被非当前工作区的进程占用，拒绝自动结束/);
    assert.match(manager, /\[System\.IO\.FileShare\]::None/);
    assert.match(manager, /taskkill\.exe \/PID \$processId \/T \/F/);
    assert.doesNotMatch(manager, /\/IM\s+(dotnet|node|chrome|msedge)/i);
});

test('相对入口 Vite 用进程工作目录识别当前工作区，并对外部工作区失败关闭', {
    skip: process.platform !== 'win32'
}, async () => {
    const viteEntry = path.join('node_modules', 'vite', 'bin', 'vite.js');
    assert.equal(fs.existsSync(path.join(clientRoot, viteEntry)), true, 'Microi.Client 必须已安装 Vite');

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
            cwd: clientRoot,
            windowsHide: true,
            stdio: 'ignore'
        });
        await waitForPort(workspacePort);

        const workspaceResult = runProcessManager('StopFrontend', workspacePort);
        assert.equal(
            workspaceResult.status,
            0,
            `${workspaceResult.stdout}\n${workspaceResult.stderr}`
        );
        assert.equal(await waitForExit(workspaceVite), true, '当前工作区相对入口 Vite 应被精确结束');

        externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-external-vite-'));
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

        const externalResult = runProcessManager('StopFrontend', externalPort);
        assert.notEqual(externalResult.status, 0, '外部工作区相对入口 Vite 必须拒绝结束');
        assert.equal(externalVite.exitCode, null, '拒绝后外部 Vite 必须继续运行');
    }
    finally {
        stopExactProcessTree(workspaceVite);
        stopExactProcessTree(externalVite);
        if (workspaceVite) await waitForExit(workspaceVite, 5000);
        if (externalVite) await waitForExit(externalVite, 5000);
        if (externalRoot) fs.rmSync(externalRoot, { recursive: true, force: true });
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
