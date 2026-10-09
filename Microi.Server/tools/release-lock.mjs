import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const domains = new Set(['api', 'pc', 'website', 'agent']);
function directory(workspace, domain) {
    if (!domains.has(domain)) throw new Error('发布锁范围必须为 api、pc、website 或 agent。');
    return path.join(path.resolve(workspace), '.tmp', 'microi-process-state', `${domain}-release.lock`);
}
function readOwner(lock) {
    try {
        const raw = fs.readFileSync(path.join(lock, 'owner.env'), 'utf8');
        const values = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => {
            const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
        }));
        return { ...values, raw };
    } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
function alive(pid) {
    if (!/^[1-9][0-9]*$/.test(String(pid || ''))) return null;
    try { process.kill(Number(pid), 0); return true; }
    catch (error) { if (error.code === 'ESRCH') return false; return true; }
}
function command(pid) {
    if (process.platform !== 'win32') {
        const result = spawnSync('ps', ['-p', String(pid), '-o', 'args='], { encoding: 'utf8', timeout: 5000 });
        return result.status === 0 ? result.stdout.trim() : '';
    }
    for (const executable of ['powershell.exe', 'pwsh.exe']) {
        const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command',
            `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; (Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`],
            { encoding: 'utf8', timeout: 5000, windowsHide: true });
        if (result.status === 0) return result.stdout.trim();
    }
    return '';
}
function normalized(value) { const text = value.replaceAll('\\', '/'); return process.platform === 'win32' ? text.toLowerCase() : text; }
function processDirectory(pid) {
    if (process.platform === 'linux') {
        try { return fs.realpathSync('/proc/' + Number(pid) + '/cwd'); } catch { return ''; }
    }
    if (process.platform === 'darwin') {
        const result = spawnSync('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8', timeout: 5000 });
        const value = result.status === 0 ? result.stdout.split(/\r?\n/).find(line => line.startsWith('n'))?.slice(1) : '';
        try { return value ? fs.realpathSync(value) : ''; } catch { return ''; }
    }
    return ''; // Windows 不能证明相对工作目录时只接受已核验的绝对入口。
}

function verifiedLegacyAgent(owner, workspace) {
    // 旧锁只有 task 标签不足以跨域放行；还要核验共享状态目录与真实进程中的 Agent 入口。
    if (!owner.workspace || !(owner.domain === 'agent' || /^(agent-|microi-code)/i.test(owner.task || ''))) return false;
    try {
        const state = value => fs.realpathSync(path.join(value, '.tmp', 'microi-process-state'));
        if (state(owner.workspace) !== state(workspace)) return false;
    } catch { return false; }
    const text = normalized(command(owner.pid));
    const root = normalized(path.resolve(owner.workspace)) + '/';
    if (text.includes(root + normalized('Microi.Agent/'))) return true;
    const entry = /(?:^|\s)["']?((?:[^\s"']*\/)?\.tmp\/agent-[^/\s]+\/(?:run-release\.py|(?:build|publish)-[^/\s"']+\.(?:py|mjs|sh)))(?=[\s"']|$)/.exec(text)?.[1];
    if (!entry) return false;
    let resolved;
    if (path.isAbsolute(entry)) resolved = path.resolve(entry);
    else {
        // Agent 旧入口既可能用绝对路径，也可能从真实工作区运行相对路径的阶段脚本。
        const cwd = processDirectory(owner.pid);
        try { if (!cwd || normalized(cwd) !== normalized(fs.realpathSync(owner.workspace))) return false; }
        catch { return false; }
        resolved = path.resolve(cwd, entry);
    }
    try {
        const actual = normalized(fs.realpathSync(resolved));
        const trusted = normalized(fs.realpathSync(owner.workspace)) + '/.tmp/agent-';
        return actual.startsWith(trusted) && fs.statSync(resolved).isFile();
    } catch { return false; }
}
function verifiedLegacyApi(owner, workspace) {
    // 已运行的旧 API 热修复保留原锁；只能从真实命令入口与共享状态目录证明范围。
    if (!owner.workspace) return false;
    try {
        const state = value => fs.realpathSync(path.join(value, '.tmp', 'microi-process-state'));
        if (state(owner.workspace) !== state(workspace)) return false;
        const text = normalized(command(owner.pid));
        if (!/(?:^|\s)--docker-only-hotfix(?:\s|$)/.test(text)) return false;
        const match = /(?:^|\s)(?:"([^"]*Microi一键编译发布\.sh)"|'([^']*Microi一键编译发布\.sh)'|([^\s"']*Microi一键编译发布\.sh))\s+--docker-only-hotfix(?:\s|$)/i.exec(text);
        const entry = match?.[1] || match?.[2] || match?.[3];
        if (!entry) return false;
        let resolved = entry;
        if (!path.isAbsolute(entry)) {
            const cwd = processDirectory(owner.pid);
            if (!cwd || normalized(cwd) !== normalized(fs.realpathSync(owner.workspace))) return false;
            resolved = path.resolve(cwd, entry);
        }
        return normalized(fs.realpathSync(resolved)) === normalized(fs.realpathSync(path.join(owner.workspace, 'Microi一键编译发布.sh')));
    } catch { return false; }
}
export function inspectLocks(workspace) {
    const state = path.join(path.resolve(workspace), '.tmp', 'microi-process-state');
    return [...domains, 'platform', 'legacy'].map(domain => {
        const lock = path.join(state, domain === 'legacy' ? 'release.lock' : `${domain}-release.lock`);
        if (!fs.existsSync(lock)) return { domain, path: lock, exists: false };
        const owner = readOwner(lock); const running = alive(owner.pid);
        let effectiveDomains = domains.has(domain) ? [domain] : domain === 'platform' ? ['api', 'pc', 'website'] : [...domains];
        if (running === true && !domains.has(domain)) {
            if (verifiedLegacyAgent(owner, workspace)) effectiveDomains = ['agent'];
            else if (verifiedLegacyApi(owner, workspace)) effectiveDomains = ['api'];
        }
        return { domain, effectiveDomains, path: lock, exists: true, pid: owner.pid || null, running };
    });
}
export function assertReleaseAvailable(workspace, domain, ownerToken = '') {
    directory(workspace, domain);
    for (const lock of inspectLocks(workspace)) {
        if (!lock.exists || lock.running === false || !lock.effectiveDomains.includes(domain)) continue;
        const owner = readOwner(lock.path);
        if (ownerToken && owner.owner_token === ownerToken && lock.domain === domain && lock.running === true) continue;
        throw new Error(`发布范围 ${domain} 正被占用：${lock.path}（PID=${lock.pid || '未知'}）。`);
    }
}
function recoverDeadLock(lock) {
    if (!fs.existsSync(lock)) return;
    const owner = readOwner(lock);
    if (alive(owner.pid) !== false) return;
    // 仅清除已经退出且 owner 文件仍逐字一致的目录；未知持有者与额外文件一律不自动删除。
    if (fs.readdirSync(lock).some(name => name !== 'owner.env')) throw new Error('发布锁含未知文件，停止自动回收。');
    if (readOwner(lock).raw !== owner.raw) throw new Error('发布锁持有者发生变化。');
    fs.unlinkSync(path.join(lock, 'owner.env'));
    fs.rmdirSync(lock);
}
export function acquireReleaseLock(workspace, domain, pid, token = crypto.randomUUID()) {
    if (alive(pid) !== true || !/^[a-zA-Z0-9-]{16,128}$/.test(token)) throw new Error('发布锁需要存活的持有进程和唯一令牌。');
    const lock = directory(workspace, domain);
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    recoverDeadLock(lock);
    recoverDeadLock(path.join(path.dirname(lock), 'release.lock'));
    recoverDeadLock(path.join(path.dirname(lock), 'platform-release.lock'));
    assertReleaseAvailable(workspace, domain);
    fs.mkdirSync(lock); // mkdir 原子抢占；另一范围拥有自己的目录，不互相排队。
    const owner = `pid=${pid}\ndomain=${domain}\nowner_token=${token}\nstarted_at=${new Date().toISOString()}\nworkspace=${path.resolve(workspace)}\n`;
    try { fs.writeFileSync(path.join(lock, 'owner.env'), owner, { flag: 'wx', mode: 0o600 }); }
    catch (error) { fs.rmdirSync(lock); throw error; }
    // 兼容旧发布进程在抢占窗口创建全局锁；只撤回自己的新锁。
    try { assertReleaseAvailable(workspace, domain, token); }
    catch (error) { releaseReleaseLock(workspace, domain, pid, token); throw error; }
    return { path: lock, token, pid: Number(pid), domain };
}
export function releaseReleaseLock(workspace, domain, pid, token) {
    const lock = directory(workspace, domain);
    if (!fs.existsSync(lock)) return false;
    const owner = readOwner(lock);
    if (owner.pid !== String(pid) || owner.owner_token !== token || owner.domain !== domain) throw new Error('只能释放本进程持有的发布锁。');
    fs.unlinkSync(path.join(lock, 'owner.env')); fs.rmdirSync(lock); return true;
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    const [action, domain, workspace, pidOrToken, token] = process.argv.slice(2);
    try {
        if (action === 'assert') assertReleaseAvailable(workspace, domain, pidOrToken || '');
        else if (action === 'status') console.log(JSON.stringify(inspectLocks(workspace)));
        else if (action === 'acquire') console.log(JSON.stringify(acquireReleaseLock(workspace, domain, pidOrToken, token)));
        else if (action === 'release') releaseReleaseLock(workspace, domain, pidOrToken, token);
        else throw new Error('未知发布锁操作。');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
