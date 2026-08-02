import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(clientRoot, '..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

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
    assert.match(manager, /processName -ne 'dotnet\.exe'/);
    assert.match(manager, /processName -ne 'node\.exe'/);
    assert.match(manager, /端口 \$Port 被非当前工作区的进程占用，拒绝自动结束/);
    assert.match(manager, /\[System\.IO\.FileShare\]::None/);
    assert.match(manager, /taskkill\.exe \/PID \$processId \/T \/F/);
    assert.doesNotMatch(manager, /\/IM\s+(dotnet|node|chrome|msedge)/i);
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
