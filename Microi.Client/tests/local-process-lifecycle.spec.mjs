import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
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

// Full 的深层相对树保持不变；使用物理系统临时根，避免候选工作区长前缀超过 Win32 启动路径限制。
const fixtureParent = fs.realpathSync(os.tmpdir());
const ownedFixtures = new Map();
const ownerFile = '.microi-process-lifecycle-owner.json';

function createFixture() {
    const root = fs.mkdtempSync(path.join(fixtureParent, 'microi-process-lifecycle-'));
    const owner = { kind: 'microi-process-lifecycle-fixture', pid: process.pid, root, nonce: randomUUID() };
    fs.writeFileSync(path.join(root, ownerFile), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    ownedFixtures.set(root, owner);
    return root;
}

function waitForFixtureFilesUnlocked(root, timeoutMs = 10000) {
    assert.ok(ownedFixtures.has(root), '只等待本用例登记的夹具');
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    // 进程 exit 回调不保证 Windows 映像/扫描句柄已释放。只重试真实共享/锁冲突，
    // 每轮仍执行原安全树检查；路径、属性、Git、链接或权限错误立即保留并报错。
    const script = [
        "$ErrorActionPreference = 'Stop'", '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)',
        '. ' + quote(path.join(repoRoot, 'Microi.Server/tools/Microi.ArtifactSafety.ps1')),
        '$clock = [Diagnostics.Stopwatch]::StartNew(); $retries = 0',
        'while ($true) { try {',
        '  Assert-MicroiArtifactTree -LiteralPath ' + quote(root),
        '  @{ retries = $retries; unlocked = $true } | ConvertTo-Json -Compress; break',
        '} catch {',
        '  $cause = $_.Exception; while ($cause.InnerException) { $cause = $cause.InnerException }',
        '  $code = $cause.HResult -band 0xffff',
        `  if ($cause -isnot [IO.IOException] -or $code -notin @(32, 33) -or $clock.ElapsedMilliseconds -ge ${timeoutMs}) { throw }`,
        '  $retries++; Start-Sleep -Milliseconds 200',
        '} }'
    ].join('\n');
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        encoding: 'utf8', windowsHide: true, timeout: timeoutMs + 10000
    });
}

function removeFixture(root) {
    assert.ok(ownedFixtures.has(root), '只能回收本用例创建的目录');
    assert.equal(path.dirname(path.resolve(root)), fixtureParent);
    assert.ok(path.basename(root).startsWith('microi-process-lifecycle-'));
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false, '夹具根必须是物理目录');
    assert.equal(fs.realpathSync(root), path.resolve(root));
    const marker = path.join(root, ownerFile);
    assert.equal(fs.lstatSync(marker).isSymbolicLink(), false, '所有权标记必须是普通文件');
    assert.equal(fs.lstatSync(marker).isFile(), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), ownedFixtures.get(root), '夹具所有权标记必须仍属于本用例');
    // Windows 先检查完整目录树及文件占用，再普通删除；避免部分删除后丢失归属标记。
    if (process.platform === 'win32') {
        const readiness = waitForFixtureFilesUnlocked(root);
        assert.ifError(readiness.error);
        assert.equal(readiness.status, 0, readiness.stdout + '\n' + readiness.stderr);
        const cleanup = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
            path.join(repoRoot, 'Microi.Server/tools/Remove-MicroiReleaseScratch.ps1'),
            '-LiteralPath', root, '-ExpectedParent', fixtureParent], {
            encoding: 'utf8', windowsHide: true, timeout: 30000
        });
        assert.ifError(cleanup.error);
        assert.equal(cleanup.status, 0, cleanup.stdout + '\n' + cleanup.stderr);
    } else {
        fs.rmSync(root, { recursive: true, force: false, maxRetries: 20, retryDelay: 250 });
    }
    ownedFixtures.delete(root);
}

function prepareCopiedRuntime(source, destination) {
    fs.copyFileSync(source, destination);
    if (process.platform !== 'darwin') return;
    // macOS 首次加载新路径下的 Mach-O 副本可能先停在 dyld 的系统校验中。
    // 在夹具准备阶段验证副本能运行；监听端口的 15 秒期限与清理隔离断言保持原样。
    const probe = spawnSync(destination, ['--version'], {
        encoding: 'utf8', timeout: 60000, windowsHide: true
    });
    assert.equal(probe.status, 0, `复制的 Node 运行时不可用：${probe.error?.message || probe.stderr}`);
    assert.equal(probe.stdout.trim(), process.version);
}

function runProcessManager(workspaceRoot, action, frontendPort, backendPort = 61501, releaseScope = 'all') {
    // StopBackend 会同时清理所选工作区的 Release 进程；测试绝不能指向真实源码工作区。
    assert.notEqual(path.resolve(workspaceRoot), repoRoot);
    assert.ok([...ownedFixtures.keys()].some(root => path.resolve(workspaceRoot).startsWith(root + path.sep)), '进程管理器只能操作本用例已登记的夹具工作区');
    return spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', path.join(repoRoot, 'Microi.Server', 'tools', 'Microi.LocalProcessManager.ps1'),
        '-Action', action,
        '-WorkspaceRoot', workspaceRoot,
        '-BackendPort', String(backendPort),
        '-FrontendPort', String(frontendPort),
        '-ReleaseScope', releaseScope
    ], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000
    });
}

async function stopExactProcessTree(child) {
    if (!child?.pid) return;
    let result;
    if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') {
            result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
        } else {
            child.kill('SIGKILL');
        }
    }
    // taskkill 与已结束的子进程可能相遇；只有本 ChildProcess 的退出事件能确认清理完成。
    assert.ifError(result?.error);
    assert.equal(await waitForExit(child, 10000), true,
        `自有夹具进程 ${child.pid} 未退出，保留目录；taskkill=${result?.status}: ${result?.stderr || ''}`);
}

test('一键发布按所选范围取得锁并调用精确进程管理器', () => {
    const script = read('Microi一键编译发布.sh');

    assert.match(script, /acquire_workspace_lock/);
    assert.match(script, /release-lock\.mjs/);
    assert.match(script, /MICROI_RELEASE_LOCK_DOMAINS/);
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

test('临时输出的 Microi.net.Api 仅在 CWD 精确属于当前工作区时可结束',  async () => {
    const testRoot = createFixture();
    const workspaceRoot = path.join(testRoot, 'workspace');
    const backendRoot = path.join(workspaceRoot, 'Microi.Server', 'Microi.net.Api');
    fs.mkdirSync(backendRoot, { recursive: true });
    const fakeBackend = path.join(testRoot, 'Microi.net.Api.exe');
    const listener = path.join(testRoot, 'listener.cjs');
    prepareCopiedRuntime(process.execPath, fakeBackend);
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
        prepareCopiedRuntime(process.execPath, otherReleasePath);
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
        await Promise.all([workspaceBackend, externalBackend, otherReleaseBackend].map(stopExactProcessTree));
        removeFixture(testRoot);
    }
});

test('相对入口 Vite 用进程工作目录识别当前工作区，并对外部工作区失败关闭',  async () => {
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
        await Promise.all([workspaceVite, externalVite].map(stopExactProcessTree));
        removeFixture(testRoot);
    }
});

test('自动化启动器阻止发布期间抢端口、只使用 Debug，并结束完整后端进程树', () => {
    const runner = read('Microi.Client/scripts/run-form-engine-freeze-trace.mjs');

    // 统一锁入口负责识别旧锁与独立 Agent 域；启动器必须明确保护平台服务。
    assert.match(runner, /import \{ assertReleaseAvailable \} from '\.\.\/\.\.\/Microi\.Server\/tools\/release-lock\.mjs'/);
    assert.match(runner, /assertReleaseAvailable\(repoRoot, 'api'\)/);
    assert.match(runner, /assertReleaseAvailable\(repoRoot, 'pc'\)/);
    assert.match(runner, /assertReleaseIsNotRunning/);
    assert.match(runner, /PW_BACKEND_CONFIGURATION \|\| 'Debug'/);
    assert.match(runner, /PW_BACKEND_CONFIGURATION=Release is forbidden/);
    assert.match(runner, /taskkill\.exe', \['\/PID', String\(child\.pid\), '\/T', '\/F'\]/);
    assert.match(runner, /stopManagedProcessTree\(backendProcess, 'backend'\)/);
    assert.doesNotMatch(runner, /backendProcess\.kill\(\)/);
});

test('DLL 被占用时报告原始路径与占用错误，不因 catch 中的错误对象丢失文件路径',  () => {
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
        const result = spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { cwd: testRoot, windowsHide: true, encoding: 'utf8', timeout: 15000 });
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
        removeFixture(testRoot);
    }
});

// 原安全模块只在 Windows 检查独占文件句柄，此新增原生用例与该平台边界一致。
if (process.platform === 'win32') test('真实文件占用超时保留完整夹具，句柄释放后安全检查才允许继续', async () => {
    const testRoot = createFixture(), held = path.join(testRoot, 'held.dll');
    fs.writeFileSync(held, 'real exclusive lock fixture');
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    const script = [
        "$ErrorActionPreference = 'Stop'",
        '$handle = [IO.File]::Open(' + quote(held) + ', [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)',
        "try { [Console]::WriteLine('LOCK_READY'); [void][Console]::ReadLine(); Start-Sleep -Milliseconds 2000 } finally { $handle.Dispose() }"
    ].join('\n');
    const holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    try {
        const ready = await Promise.race([once(holder.stdout, 'data').then(([data]) => String(data)), delay(10000).then(() => '')]);
        assert.match(ready, /LOCK_READY/);
        const blocked = waitForFixtureFilesUnlocked(testRoot, 200);
        assert.ifError(blocked.error);
        assert.notEqual(blocked.status, 0, '真实持续占用必须失败，不能吞掉安全检查');
        assert.ok(fs.existsSync(held));
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(testRoot, ownerFile), 'utf8')), ownedFixtures.get(testRoot));
        holder.stdin.end('\n');
        const released = waitForFixtureFilesUnlocked(testRoot, 10000);
        assert.ifError(released.error);
        assert.equal(released.status, 0, released.stdout + '\n' + released.stderr);
        assert.equal(JSON.parse(released.stdout).unlocked, true);
        assert.equal(await waitForExit(holder), true, '持锁进程必须真实退出');
        assert.ok(fs.existsSync(held), '等待过程不得删除文件');
    } finally {
        await stopExactProcessTree(holder);
        removeFixture(testRoot);
    }
});

for(const scope of ['api','pc'])test(`真实 PrepareRelease ${scope} 只清理自身范围，另一范围服务保持监听`,async()=>{
    const testRoot=createFixture(),workspaceRoot=path.join(testRoot,'workspace');
    const backendRoot=path.join(workspaceRoot,'Microi.Server/Microi.net.Api'),frontendRoot=path.join(workspaceRoot,'Microi.Client');
    fs.mkdirSync(backendRoot,{recursive:true});fs.mkdirSync(frontendRoot,{recursive:true});
    const fakeBackend=path.join(testRoot,'Microi.net.Api.exe'),listener=path.join(testRoot,'listener.cjs');
    prepareCopiedRuntime(process.execPath,fakeBackend);
    fs.writeFileSync(listener,"require('node:net').createServer(()=>{}).listen(Number(process.argv[2]),'127.0.0.1');");
    const viteEntry=path.join('node_modules','vite','bin','vite.js'),fixtureEntry=path.join(frontendRoot,viteEntry);
    fs.mkdirSync(path.dirname(fixtureEntry),{recursive:true});
    fs.writeFileSync(path.join(frontendRoot,'package.json'),'{"type":"module"}');
    fs.writeFileSync(path.join(frontendRoot,'index.html'),'<!doctype html><title>Scoped release fixture</title>');
    fs.writeFileSync(fixtureEntry,`import ${JSON.stringify(pathToFileURL(path.join(clientRoot,viteEntry)).href)};`);
    let backend,frontend;
    try{
        const backendPort=await reservePort(),frontendPort=await reservePort();
        backend=spawn(fakeBackend,[listener,String(backendPort)],{cwd:backendRoot,stdio:'ignore'});
        frontend=spawn(process.execPath,[viteEntry,'--host','127.0.0.1','--port',String(frontendPort),'--strictPort'],{cwd:frontendRoot,stdio:'ignore'});
        await waitForPort(backendPort);await waitForPort(frontendPort);
        const result=runProcessManager(workspaceRoot,'PrepareRelease',frontendPort,backendPort,scope);
        assert.equal(result.status,0,result.stdout+result.stderr);
        const selected=scope==='api'?backend:frontend,retained=scope==='api'?frontend:backend;
        assert.equal(await waitForExit(selected),true,'所选范围进程必须退出');
        assert.equal(retained.exitCode,null,'另一个范围的进程必须保留');
        await waitForPort(scope==='api'?frontendPort:backendPort);
    }finally{
        await Promise.all([backend,frontend].map(stopExactProcessTree));
        removeFixture(testRoot);
    }
});

test('Full 独立编译目录的真实 apphost 只按当前工作区与 API CWD 精确清理',async()=>{
    const testRoot=createFixture(),workspaceRoot=path.join(testRoot,'workspace');
    const backendRoot=path.join(workspaceRoot,'Microi.Server','Microi.net.Api');
    const executable=path.join(workspaceRoot,'.tmp','microi-release-gate','20261007-095710-29038','.net-artifacts','bin','Microi.net.Api','release',process.platform==='win32'?'Microi.net.Api.exe':'Microi.net.Api');
    fs.mkdirSync(backendRoot,{recursive:true});fs.mkdirSync(path.dirname(executable),{recursive:true});
    prepareCopiedRuntime(process.execPath,executable);
    const listener=path.join(testRoot,'listener.cjs'),foreignCwd=path.join(testRoot,'foreign');
    fs.mkdirSync(foreignCwd);fs.writeFileSync(listener,"require('node:net').createServer(()=>{}).listen(Number(process.argv[2]),'127.0.0.1');");
    let owned,foreign;
    try{
        const ownedPort=await reservePort(),foreignPort=await reservePort();
        owned=spawn(executable,[listener,String(ownedPort)],{cwd:backendRoot,stdio:'ignore'});
        foreign=spawn(executable,[listener,String(foreignPort)],{cwd:foreignCwd,stdio:'ignore'});
        await waitForPort(ownedPort);await waitForPort(foreignPort);
        const accepted=runProcessManager(workspaceRoot,'StopBackend',61500,ownedPort);
        assert.equal(accepted.status,0,accepted.stdout+accepted.stderr);
        assert.equal(await waitForExit(owned),true,'Full 自有 apphost 必须可精确回收');
        assert.equal(foreign.exitCode,null,'错误 CWD 的同名进程必须继续监听');
        const rejected=runProcessManager(workspaceRoot,'StopBackend',61500,foreignPort);
        assert.notEqual(rejected.status,0,'错误 CWD 必须失败关闭');
        assert.equal(foreign.exitCode,null);await waitForPort(foreignPort);
    }finally{
        await Promise.all([owned,foreign].map(stopExactProcessTree));
        removeFixture(testRoot);
    }
});
