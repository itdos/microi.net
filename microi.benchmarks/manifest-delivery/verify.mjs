import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const testFiles = ['manifest-preflight.test.ts', 'manifest-context.test.ts', 'manifest-field-relations.test.ts', 'manifest-microservice-module.test.ts', 'advanced-tools-validation-envelope.test.ts'];
const sourceFiles = ['advanced-tools.ts', 'manifest-preflight.ts', 'manifest-context.ts', 'manifest-context-fixtures.ts', ...testFiles];
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** 只接受测试运行器的完整总账；零测试、漏项、跳过或退出失败均不算通过。 */
export function tapResult(text, exitCode) {
  const result = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const values = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`, 'gm'))];
    result[key] = values.length === 1 ? Number(values[0][1]) : null;
  }
  const complete = Object.values(result).every(Number.isSafeInteger);
  return { ...result, passed: complete && exitCode === 0 && result.tests >= 54 && result.tests === result.pass && ['fail', 'cancelled', 'skipped', 'todo'].every(key => result[key] === 0) };
}
async function hashes() {
  const result = {};
  for (const name of sourceFiles) {
    const bytes = await readFile(path.join(root, 'microi.mcp/src', name));
    result[name] = { bytes: bytes.length, rawSha256: sha256(bytes), lfSha256: sha256(bytes.toString('utf8').replaceAll('\r\n', '\n')) };
  }
  return result;
}
export async function verify() {
  const startedAt = new Date().toISOString();
  const before = await hashes();
  const require = createRequire(path.join(root, 'microi.mcp/package.json'));
  const loader = pathToFileURL(require.resolve('tsx')).href;
  // 直接执行正式注册处理器及原有客户端边界夹具，不复制一份较弱的验证实现。
  // 客户端是确定性替身：本检查不连接业务数据库、API 或模型，不称为远端 E2E。
  const run = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=256', '--import', loader, '--test', '--test-concurrency=1', ...testFiles.map(name => 'src/' + name)], {
      cwd: path.join(root, 'microi.mcp'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 4 * 1024 * 1024) child.kill(); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 65536) child.kill(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, timedOut }); });
  });
  const after = await hashes();
  const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
  const counters = tapResult(run.stdout, run.code);
  return {
    protocolVersion: '1.0.0', evidenceKind: 'registered-handler-contract', startedAt, completedAt: new Date().toISOString(),
    environment: { node: process.version, os: os.platform(), osRelease: os.release(), arch: os.arch() },
    testFiles, sources: before, sourceUnchanged, counters, exitCode: run.code, timedOut: run.timedOut,
    rawTapSha256: sha256(run.stdout), stderrSha256: sha256(run.stderr),
    passed: sourceUnchanged && counters.passed && !run.timedOut,
    boundaries: { realProviderCalls: 0, remoteBusinessWrites: 0, databaseExecutionVerified: false, browserVerified: false, certification: false },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('InvalidArgs');
    // 必须先独占占位，不能执行后才发现会覆盖已有结果。
    if (args.length) await writeFile(args[1], '{"status":"prepared"}\n', { flag: 'wx' });
    const report = await verify();
    if (args.length) await writeFile(args[1], JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
  } catch { console.error('声明检查未完成；检查依赖、参数与本地记录。未连接业务或模型服务。'); process.exitCode = 1; }
}
