import { spawn, spawnSync } from 'node:child_process';
import {
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { calculateBuildMemoryPlan } from './build-memory-plan.mjs';

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const viteBin = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js');
const modernMinifier = path.join(scriptDir, 'minify-modern-output.mjs');
const legacyBuilder = path.join(scriptDir, 'build-legacy-from-modern.mjs');
const processTreeMemoryControl = path.join(scriptDir, 'process-tree-memory-control.ps1');
const modernOutDir = path.join(projectDir, 'bin', 'Release', 'dist');
const legacyOutDir = path.join(projectDir, 'bin', 'Release', '.legacy-dist');
const logDir = path.join(projectDir, '.tmp', 'build-logs');
const guardPidPath = path.join(logDir, 'guard.pid');
const totalMemory = os.totalmem();
const freeMemory = os.freemem();
const pauseMemoryUsageRatio = 0.95;
const resumeMemoryUsageRatio = 0.9;
const resumeStableSampleCount = 5;
// 当前 14802 模块的现代浏览器完整依赖图（含 go-view）实测在 Rollup
// 输出 757 个 chunk 时，5 GB 堆会 OOM，进程树峰值约 5.4 GB。
// Vite 只生成未压缩现代 ESM；它退出后由独立 1.5 GB 子进程逐文件压缩，
// Chrome 49 再由独立 2 GB 子进程逐 chunk 串行转换，三个阶段的峰值不会叠加。
const defaultHeapMb = 6144;
const measuredModernProcessTreePeakMb = 6144;
const modernMinifyHeapMb = 1536;
const legacyHeapMb = 2048;
const maxHeapByHostMb = Math.max(1024, Math.floor(totalMemory / MB * 0.25));
const requestedHeapMb = Number.parseInt(process.env.MICROI_BUILD_HEAP_MB || '', 10);
const heapMb = Math.min(
    Number.isFinite(requestedHeapMb) && requestedHeapMb > 0 ? requestedHeapMb : defaultHeapMb,
    maxHeapByHostMb
);
// Node 堆之外还要容纳 young generation、代码、Buffer 和 esbuild 原生进程。
// 每个顺序阶段独立按“受控堆 + 原生开销 + 系统安全余量”计算启动目标，
// 不使用物理内存 20% 的线性保留门槛，也不叠加不会并发的阶段峰值。
const modernMemoryPlan = calculateBuildMemoryPlan({
    totalMemory,
    heapLimitMb: heapMb,
    // 本机实测 5.4 GB 左右，按 6 GB 作为含约 10% 余量的阶段总预算。
    processTreePeakMb: Math.min(measuredModernProcessTreePeakMb, maxHeapByHostMb),
    pauseMemoryUsageRatio
});
const modernMinifyMemoryPlan = calculateBuildMemoryPlan({
    totalMemory,
    heapLimitMb: modernMinifyHeapMb,
    pauseMemoryUsageRatio
});
const legacyMemoryPlan = calculateBuildMemoryPlan({
    totalMemory,
    heapLimitMb: legacyHeapMb,
    pauseMemoryUsageRatio
});
const systemSafetyMemory = modernMemoryPlan.systemSafetyMemory;
const requiredModernStartMemory = modernMemoryPlan.requiredStartMemory;
const requiredModernMinifyStartMemory = modernMinifyMemoryPlan.requiredStartMemory;
const requiredLegacyStartMemory = legacyMemoryPlan.requiredStartMemory;
const esbuildParallelism = Math.max(
    1,
    Math.min(Number.parseInt(process.env.MICROI_ESBUILD_PROCS || '2', 10) || 2, os.cpus().length, 2)
);
const buildMemoryNoticeThreshold = totalMemory * 0.25;
const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const legacyOnly = rawArgs.includes('--legacy-only');
const preflightOnly = rawArgs.includes('--preflight-only');
const viteArgs = ['build', ...rawArgs.filter((arg) => ![
    '--dry-run',
    '--legacy-only',
    '--preflight-only'
].includes(arg))];
const interactiveInput = process.stdin.isTTY || process.env.MICROI_BUILD_INTERACTIVE === '1';
const skipMemoryWaitFromEnv = /^(?:1|true|yes|on)$/i.test(
    String(process.env.MICROI_BUILD_SKIP_MEMORY_WAIT || '').trim()
);

let memoryWaitBypassed = skipMemoryWaitFromEnv;
let waitingForMemory = false;
let memoryWaitInput = null;
let finishMemoryWaitPoll = null;

function formatGb(bytes) {
    return (bytes / GB).toFixed(1);
}

function formatPercent(ratio) {
    return (ratio * 100).toFixed(1);
}

function nodeOptionsWithHeapLimit(value, limitMb = heapMb) {
    return String(value || '')
        .replace(/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/g, ' ')
        .replace(/(?:^|\s)--max[-_]semi[-_]space[-_]size(?:=|\s+)\d+/g, ' ')
        .trim()
        .concat(` --max-old-space-size=${limitMb}`)
        .trim();
}

function stopProcessTree(pid) {
    if (!pid) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
        });
        return;
    }

    try {
        process.kill(-pid, 'SIGTERM');
    } catch {
        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            // 子进程可能已经自行退出。
        }
    }
}

function setProcessTreeSuspended(pid, suspended) {
    if (!pid) return { ok: true, detail: '没有活动子进程。' };

    if (process.platform === 'win32') {
        if (!existsSync(processTreeMemoryControl)) {
            return {
                ok: false,
                detail: `缺少进程树内存控制脚本：${processTreeMemoryControl}`
            };
        }

        const result = spawnSync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            processTreeMemoryControl,
            '-Action',
            suspended ? 'Suspend' : 'Resume',
            '-RootPid',
            String(pid)
        ], {
            encoding: 'utf8',
            timeout: 15000,
            windowsHide: true
        });
        const detail = [result.stdout, result.stderr, result.error?.message]
            .filter(Boolean)
            .join('\n')
            .trim();
        return {
            ok: !result.error && result.status === 0,
            detail: detail || `PowerShell 退出码 ${result.status ?? 'unknown'}`
        };
    }

    try {
        process.kill(-pid, suspended ? 'SIGSTOP' : 'SIGCONT');
        return { ok: true, detail: `${suspended ? 'SIGSTOP' : 'SIGCONT'} 已发送。` };
    } catch (error) {
        return { ok: false, detail: error.message };
    }
}

function assertSafeBuildPath(targetPath) {
    const relative = path.relative(projectDir, targetPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`拒绝操作项目目录之外的构建路径：${targetPath}`);
    }
}

function readLogTail(logPath, lineCount = 60) {
    if (!existsSync(logPath)) return '';
    return readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-lineCount).join('\n');
}

function waitForMemoryPoll(ms) {
    if (memoryWaitBypassed) return Promise.resolve();

    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (finishMemoryWaitPoll === finish) finishMemoryWaitPoll = null;
            resolve();
        };
        timer = setTimeout(finish, ms);
        finishMemoryWaitPoll = finish;
    });
}

function printMemoryWaitBypassHint() {
    if (interactiveInput) {
        console.warn(
            '[Microi build guard] 如需忽略内存保护继续，请输入 s（或 skip）后按回车。'
        );
        return;
    }

    console.warn(
        '[Microi build guard] 当前不是交互终端；无人值守时可设置 ' +
        'MICROI_BUILD_SKIP_MEMORY_WAIT=1 跳过本次构建的内存等待。'
    );
}

function bypassMemoryWait(source) {
    if (memoryWaitBypassed) return;

    memoryWaitBypassed = true;
    waitingForMemory = false;
    finishMemoryWaitPoll?.();
    console.warn(
        `\n[Microi build guard] 已通过${source}跳过内存等待；` +
        '本次前端构建余下阶段不再自动等待或暂停。内存不足时仍可能构建失败或影响系统稳定。'
    );

    if (!pausedForMemory || !activeChild?.pid) return;

    const result = setProcessTreeSuspended(activeChild.pid, false);
    if (!result.ok) {
        stoppedForMemory = true;
        console.error(
            `[Microi build guard] 无法恢复已暂停的构建进程树（${result.detail}），` +
            '正在终止本次构建树，避免留下挂起进程。'
        );
        stopProcessTree(activeChild.pid);
        return;
    }

    pausedForMemory = false;
    resumeStableSamples = 0;
    lastProgressAt = Date.now();
    console.warn(`[Microi build guard] 已强制继续${activePhaseName}。`);
}

function startMemoryWaitInput() {
    if (!interactiveInput || !process.stdin.readable || process.stdin.destroyed) return;

    memoryWaitInput = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity
    });
    memoryWaitInput.on('line', (line) => {
        if (!waitingForMemory) return;

        const command = line.trim().toLowerCase();
        if (command === 's' || command === 'skip') {
            bypassMemoryWait('用户指令');
        } else if (command) {
            console.warn('[Microi build guard] 未识别该指令；请输入 s（或 skip）后按回车。');
        }
    });
}

function closeMemoryWaitInput() {
    memoryWaitInput?.close();
    memoryWaitInput = null;
}

async function waitForStartMemory(context, requiredStartMemory) {
    if (memoryWaitBypassed) return;

    let available = os.freemem();
    if (available >= requiredStartMemory) return;

    waitingForMemory = true;
    console.warn(
        `[Microi build guard] ${context}前可用内存 ${formatGb(available)} GB，` +
        `低于启动目标 ${formatGb(requiredStartMemory)} GB；暂不启动新构建，等待内存恢复。`
    );
    printMemoryWaitBypassHint();
    let lastWaitLogAt = 0;
    while (available < requiredStartMemory && !memoryWaitBypassed) {
        await waitForMemoryPoll(5000);
        if (memoryWaitBypassed) break;
        available = os.freemem();
        if (Date.now() - lastWaitLogAt >= 30000) {
            lastWaitLogAt = Date.now();
            const usageRatio = 1 - available / totalMemory;
            console.log(
                `[Microi build guard] 等待${context}：可用 ${formatGb(available)} GB，` +
                `全机占用 ${formatPercent(usageRatio)}%。`
            );
        }
    }
    waitingForMemory = false;
    if (memoryWaitBypassed) return;

    console.log(
        `[Microi build guard] 内存已恢复到 ${formatGb(available)} GB，继续${context}。`
    );
}

console.log(
    `[Microi build guard] 物理内存 ${formatGb(totalMemory)} GB，可用 ${formatGb(freeMemory)} GB，` +
    `现代 Vite 堆上限 ${heapMb} MB，esbuild 并行 ${esbuildParallelism}，` +
    `现代串行压缩 ${modernMinifyHeapMb} MB，legacy ${legacyHeapMb} MB。`
);
console.log(
    `[Microi build guard] 系统安全余量 ${formatGb(systemSafetyMemory)} GB，` +
    `现代 Vite 实测峰值预算 ${formatGb(modernMemoryPlan.phaseBudgetMemory)} GB；` +
    `各顺序阶段启动目标：现代 Vite ${formatGb(requiredModernStartMemory)} GB，` +
    `现代串行压缩 ${formatGb(requiredModernMinifyStartMemory)} GB，` +
    `legacy ${formatGb(requiredLegacyStartMemory)} GB（阶段峰值不叠加）；` +
    '全机占用达到 95% 时自动暂停整个构建进程树，降至 90% 并稳定 5 秒后继续。'
);
if (skipMemoryWaitFromEnv) {
    console.warn(
        '[Microi build guard] 已通过 MICROI_BUILD_SKIP_MEMORY_WAIT 跳过本次构建的全部内存等待和自动暂停。'
    );
}

if (!existsSync(viteBin)) {
    console.error('[Microi build guard] 未找到本地 Vite，请先执行 npm install。');
    process.exit(1);
}
if (!existsSync(modernMinifier)) {
    console.error(`[Microi build guard] 未找到现代产物压缩器：${modernMinifier}`);
    process.exit(1);
}
if (!existsSync(legacyBuilder)) {
    console.error(`[Microi build guard] 未找到 Chrome 49 转换器：${legacyBuilder}`);
    process.exit(1);
}

if (preflightOnly) {
    if (!memoryWaitBypassed && freeMemory < requiredModernStartMemory) {
        console.error(
            `[Microi build guard] 发布前资源预检未通过：当前可用 ${formatGb(freeMemory)} GB，` +
            `现代阶段需要至少 ${formatGb(requiredModernStartMemory)} GB。` +
            '请先关闭不需要的 WSL、后端、浏览器或其它重任务后重试。'
        );
        process.exit(2);
    }
    console.log('[Microi build guard] 发布前资源预检通过，未启动 Vite。');
    process.exit(0);
}

if (dryRun) {
    if (memoryWaitBypassed) {
        console.log('[Microi build guard] dry-run：实际构建将按配置跳过内存等待和自动暂停。');
    } else if (freeMemory < requiredModernStartMemory) {
        console.log(
            `[Microi build guard] dry-run：当前可用 ${formatGb(freeMemory)} GB；` +
            `实际构建会等待到 ${formatGb(requiredModernStartMemory)} GB 后再启动现代阶段。`
        );
    } else {
        console.log('[Microi build guard] 资源检查通过（dry-run，未启动 Vite）。');
    }
    process.exit(0);
}

let stoppedForMemory = false;
let pausedForMemory = false;
let resumeStableSamples = 0;
let activeChild = null;
let activePhaseName = '';
let phaseStartFreeMemory = freeMemory;
let lastProgressAt = 0;
let warnedForPhaseMemory = false;

startMemoryWaitInput();

mkdirSync(logDir, { recursive: true });
writeFileSync(guardPidPath, `${process.pid}\n`, 'utf8');

const monitor = setInterval(() => {
    if (!activeChild) return;
    const available = os.freemem();
    const phaseMemoryDrop = Math.max(0, phaseStartFreeMemory - available);
    const systemMemoryUsageRatio = 1 - available / totalMemory;
    const progressInterval = pausedForMemory ? 10000 : 30000;
    if (Date.now() - lastProgressAt >= progressInterval) {
        lastProgressAt = Date.now();
        console.log(
            `[Microi build guard] ${activePhaseName}${pausedForMemory ? '已暂停' : '进行中'}：` +
            `可用 ${formatGb(available)} GB，` +
            `全机占用 ${formatPercent(systemMemoryUsageRatio)}%，本阶段可用内存下降 ${formatGb(phaseMemoryDrop)} GB。`
        );
    }

    // 可用内存变化还包含 IDE、浏览器和系统缓存，不能据此把阶段下降量当作构建进程树的精确占用。
    // 超过 25% 时只提示；全机达到 95% 时暂停整个进程树，不把阶段估算当作硬阈值。
    if (phaseMemoryDrop > buildMemoryNoticeThreshold && !warnedForPhaseMemory) {
        warnedForPhaseMemory = true;
        console.warn(
            `[Microi build guard] 本阶段可用内存已下降 ${formatGb(phaseMemoryDrop)} GB，` +
            '该数值包含其它进程和系统缓存变化；构建继续运行，全机达到 95% 时才暂停。'
        );
    }

    if (pausedForMemory) {
        if (systemMemoryUsageRatio <= resumeMemoryUsageRatio) {
            resumeStableSamples += 1;
        } else {
            resumeStableSamples = 0;
        }

        if (resumeStableSamples < resumeStableSampleCount) return;

        const result = setProcessTreeSuspended(activeChild.pid, false);
        if (!result.ok) {
            stoppedForMemory = true;
            console.error(
                `\n[Microi build guard] 内存恢复后无法继续构建（${result.detail}），` +
                '正在终止本次构建树，避免留下挂起进程。'
            );
            stopProcessTree(activeChild.pid);
            return;
        }

        pausedForMemory = false;
        waitingForMemory = false;
        resumeStableSamples = 0;
        lastProgressAt = Date.now();
        console.log(
            `\n[Microi build guard] 全机内存已连续 ${resumeStableSampleCount} 秒低于或等于 ` +
            `${formatPercent(resumeMemoryUsageRatio)}%，继续${activePhaseName}。`
        );
        return;
    }

    if (memoryWaitBypassed || systemMemoryUsageRatio < pauseMemoryUsageRatio || stoppedForMemory) return;

    const reason = `全机内存占用已达 ${formatPercent(systemMemoryUsageRatio)}%（可用 ${formatGb(available)} GB）`;
    console.warn(`\n[Microi build guard] ${reason}，正在暂停${activePhaseName}进程树。`);
    const result = setProcessTreeSuspended(activeChild.pid, true);
    if (result.ok) {
        pausedForMemory = true;
        resumeStableSamples = 0;
        lastProgressAt = Date.now();
        console.warn(
            `[Microi build guard] 构建已暂停；将持续监听，` +
            `全机占用降至 ${formatPercent(resumeMemoryUsageRatio)}% 并稳定 ` +
            `${resumeStableSampleCount} 秒后自动继续。`
        );
        waitingForMemory = true;
        printMemoryWaitBypassHint();
        return;
    }

    stoppedForMemory = true;
    console.error(
        `[Microi build guard] 无法安全暂停进程树（${result.detail}），` +
        '正在终止本次构建树作为保护回退。'
    );
    stopProcessTree(activeChild.pid);
}, 1000);

const handleSignal = (signal) => {
    clearInterval(monitor);
    closeMemoryWaitInput();
    if (pausedForMemory && activeChild?.pid) {
        setProcessTreeSuspended(activeChild.pid, false);
    }
    stopProcessTree(activeChild?.pid);
    rmSync(guardPidPath, { force: true });
    process.exit(signal === 'SIGINT' ? 130 : 143);
};

process.once('SIGINT', () => handleSignal('SIGINT'));
process.once('SIGTERM', () => handleSignal('SIGTERM'));

async function runVitePhase(name, variant, outDir) {
    await waitForStartMemory(`${name}构建`, requiredModernStartMemory);
    return new Promise((resolve, reject) => {
        phaseStartFreeMemory = os.freemem();
        activePhaseName = name;
        lastProgressAt = 0;
        warnedForPhaseMemory = false;
        pausedForMemory = false;
        waitingForMemory = false;
        resumeStableSamples = 0;

        mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, variant === 'modern' ? 'modern.log' : 'legacy.log');
        const logFd = openSync(logPath, 'w');
        let logClosed = false;
        const closeLog = () => {
            if (logClosed) return;
            logClosed = true;
            closeSync(logFd);
        };

        console.log(`\n[Microi build guard] 开始${name}构建，详细日志：${logPath}`);
        activeChild = spawn(process.execPath, [viteBin, ...viteArgs], {
            cwd: projectDir,
            detached: process.platform !== 'win32',
            env: {
                ...process.env,
                NODE_OPTIONS: nodeOptionsWithHeapLimit(process.env.NODE_OPTIONS),
                GOMAXPROCS: String(esbuildParallelism),
                MICROI_BUILD_VARIANT: variant,
                MICROI_BUILD_OUT_DIR: outDir
            },
            stdio: ['ignore', logFd, logFd],
            windowsHide: true
        });

        activeChild.once('error', (error) => {
            closeLog();
            activeChild = null;
            pausedForMemory = false;
            waitingForMemory = false;
            resumeStableSamples = 0;
            reject(new Error(`无法启动 ${name} Vite：${error.message}`));
        });
        activeChild.once('exit', (code, signal) => {
            closeLog();
            activeChild = null;
            pausedForMemory = false;
            waitingForMemory = false;
            resumeStableSamples = 0;
            if (stoppedForMemory) {
                reject(new Error(`${name}构建触发内存保护。`));
                return;
            }
            if (signal) {
                reject(new Error(`${name} Vite 被信号 ${signal} 终止。`));
                return;
            }
            if (code !== 0) {
                const tail = readLogTail(logPath);
                if (tail) console.error(`\n[Microi build guard] ${name}失败日志末尾：\n${tail}`);
                reject(new Error(`${name} Vite 构建失败，退出码 ${code ?? 'unknown'}。`));
                return;
            }
            console.log(`[Microi build guard] ${name}构建完成。`);
            resolve();
        });
    });
}

async function runNodeScriptPhase({ name, scriptPath, heapLimitMb, requiredStartMemory, logName }) {
    await waitForStartMemory(name, requiredStartMemory);
    return new Promise((resolve, reject) => {
        phaseStartFreeMemory = os.freemem();
        activePhaseName = name;
        lastProgressAt = 0;
        warnedForPhaseMemory = false;
        pausedForMemory = false;
        waitingForMemory = false;
        resumeStableSamples = 0;

        mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, logName);
        const logFd = openSync(logPath, 'w');
        let logClosed = false;
        const closeLog = () => {
            if (logClosed) return;
            logClosed = true;
            closeSync(logFd);
        };

        console.log(`\n[Microi build guard] 开始${name}，详细日志：${logPath}`);
        activeChild = spawn(process.execPath, [
            '--expose-gc',
            `--max-old-space-size=${heapLimitMb}`,
            scriptPath
        ], {
            cwd: projectDir,
            detached: process.platform !== 'win32',
            env: {
                ...process.env,
                NODE_OPTIONS: nodeOptionsWithHeapLimit(process.env.NODE_OPTIONS, heapLimitMb),
                GOMAXPROCS: String(esbuildParallelism)
            },
            stdio: ['ignore', logFd, logFd],
            windowsHide: true
        });

        activeChild.once('error', (error) => {
            closeLog();
            activeChild = null;
            pausedForMemory = false;
            waitingForMemory = false;
            resumeStableSamples = 0;
            reject(new Error(`无法启动 ${name}：${error.message}`));
        });
        activeChild.once('exit', (code, signal) => {
            closeLog();
            activeChild = null;
            pausedForMemory = false;
            waitingForMemory = false;
            resumeStableSamples = 0;
            if (stoppedForMemory) {
                reject(new Error(`${name}触发内存保护。`));
                return;
            }
            if (signal) {
                reject(new Error(`${name}被信号 ${signal} 终止。`));
                return;
            }
            if (code !== 0) {
                const tail = readLogTail(logPath);
                if (tail) console.error(`\n[Microi build guard] ${name}失败日志末尾：\n${tail}`);
                reject(new Error(`${name}失败，退出码 ${code ?? 'unknown'}。`));
                return;
            }
            console.log(`[Microi build guard] ${name}完成。`);
            resolve();
        });
    });
}

function runModernMinificationPhase() {
    return runNodeScriptPhase({
        name: '现代 JS 逐文件串行压缩',
        scriptPath: modernMinifier,
        heapLimitMb: modernMinifyHeapMb,
        requiredStartMemory: requiredModernMinifyStartMemory,
        logName: 'modern-minify.log'
    });
}

function runLegacyConversionPhase() {
    return runNodeScriptPhase({
        name: 'Chrome 49 legacy串行转换',
        scriptPath: legacyBuilder,
        heapLimitMb: legacyHeapMb,
        requiredStartMemory: requiredLegacyStartMemory,
        logName: 'legacy.log'
    });
}

try {
    assertSafeBuildPath(modernOutDir);
    assertSafeBuildPath(legacyOutDir);
    rmSync(legacyOutDir, { recursive: true, force: true });

    if (!legacyOnly) {
        await runVitePhase('现代浏览器', 'modern', modernOutDir);
        await runModernMinificationPhase();
    } else if (!existsSync(path.join(modernOutDir, 'index.html'))) {
        throw new Error('--legacy-only 需要已有的现代浏览器 index.html。');
    }
    await runLegacyConversionPhase();
    rmSync(legacyOutDir, { recursive: true, force: true });
    console.log('\n[Microi build guard] 现代与 Chrome 49 legacy 产物已合并完成。');
} catch (error) {
    console.error(`[Microi build guard] ${error.message}`);
    process.exitCode = stoppedForMemory ? 137 : 1;
} finally {
    clearInterval(monitor);
    closeMemoryWaitInput();
    rmSync(guardPidPath, { force: true });
}
