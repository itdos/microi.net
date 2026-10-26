import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const testFiles = ['manifest-preflight.test.ts', 'manifest-context.test.ts', 'manifest-field-relations.test.ts', 'manifest-microservice-module.test.ts', 'advanced-tools-validation-envelope.test.ts'];
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** 只接受测试运行器的完整总账；零测试、漏项、跳过或退出失败均不算通过。 */
export function tapResult(text, exitCode, minimumTests = 60) {
  const result = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const values = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`, 'gm'))];
    result[key] = values.length === 1 ? Number(values[0][1]) : null;
  }
  const complete = Object.values(result).every(Number.isSafeInteger);
  return { ...result, passed: complete && exitCode === 0 && Number.isSafeInteger(minimumTests) && minimumTests > 0 && result.tests >= minimumTests && result.tests === result.pass && ['fail', 'cancelled', 'skipped', 'todo'].every(key => result[key] === 0) };
}
/** 诊断只使用已绑定的公开源文件名和静态测试标题；动态值、错误正文和堆栈不回显。 */
export function failureDiagnostics(tap, testSources) {
  const known = Object.entries(testSources).map(([name, source]) => ({
    file: `microi.mcp/src/${name}`,
    titles: new Set([...source.matchAll(/\b(?:test|it)\s*\(\s*(['"])([^'"\r\n\\]*)\1\s*,/gu)].map(match => match[2])),
  }));
  const failed = [...tap.matchAll(/^\s*not ok \d+ - (.+)\r?$/gm)];
  const items = failed.slice(0, 20).map((match, index) => {
    const title = match[1].replace(/\r$/, '');
    const block = tap.slice(match.index + match[0].length, Math.min(failed[index + 1]?.index ?? tap.length, match.index + 8192));
    const location = block.match(/^\s+location:\s*(.+)\r?$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '').replace(/\\+/g, '/').replace(/:\d+(?::\d+)?$/, '');
    const file = known.find(candidate => location?.endsWith('/' + candidate.file) || title.replace(/\\+/g, '/').endsWith('/' + candidate.file))
      ?? known.find(candidate => candidate.titles.has(title));
    return file ? { file: file.file, ...(file.titles.has(title) ? { title: title.slice(0, 200) } : {}) } : { file: null };
  });
  return { total: failed.length, omitted: failed.length - items.length, items };
}
export function failureAnnotations(diagnostics) {
  const escape = value => value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return diagnostics.items.slice(0, 20).map(item => `::error title=MCP regression::${escape(item.file ? item.file + (item.title ? ': ' + item.title : '') : 'Unmapped test failure')}`);
}
function hashBytes(bytes) {
  return { bytes: bytes.length, rawSha256: sha256(bytes), lfSha256: sha256(bytes.toString('utf8').replaceAll('\r\n', '\n')) };
}
async function hashes(names) {
  const result = {};
  for (const name of names) result[name] = hashBytes(await readFile(path.join(root, 'microi.mcp', name)));
  return result;
}
async function sourceSnapshot() {
  const names = [];
  async function walk(directory = '') {
    for (const entry of await readdir(path.join(root, 'microi.mcp/src', directory), { withFileTypes: true })) {
      const name = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) names.push(name);
      else throw new Error('UnsupportedSourceEntry'); // 不追随符号链接或把仓库外文件纳入证据。
    }
  }
  await walk();
  const result = {};
  for (const name of names.sort()) result[name] = hashBytes(await readFile(path.join(root, 'microi.mcp/src', name)));
  return result;
}
function treeDigest(sources) {
  const entries = Object.entries(sources);
  return {
    fileCount: entries.length,
    rawSha256: sha256(JSON.stringify(entries.map(([name, value]) => [name, value.bytes, value.rawSha256]))),
    lfSha256: sha256(JSON.stringify(entries.map(([name, value]) => [name, value.lfSha256]))),
  };
}
export async function verify({ suite = 'manifest' } = {}) {
  if (!['manifest', 'full'].includes(suite)) throw new Error('InvalidSuite');
  const startedAt = new Date().toISOString();
  const before = await sourceSnapshot();
  const selectedTests = suite === 'full' ? Object.keys(before).filter(name => name.endsWith('.test.ts')) : testFiles;
  const minimumTests = suite === 'full' ? 355 : 60;
  if (!selectedTests.length || selectedTests.some(name => !Object.hasOwn(before, name))) throw new Error('MissingTestInput');
  const dependencyInputs = await hashes(['package.json', 'package-lock.json']);
  const compilerInputs = await hashes(['tsconfig.json']);
  const testSources = Object.fromEntries(await Promise.all(selectedTests.map(async name => [name, await readFile(path.join(root, 'microi.mcp/src', name), 'utf8')])));
  const runnerBefore = await readFile(fileURLToPath(import.meta.url));
  const require = createRequire(path.join(root, 'microi.mcp/package.json'));
  const loader = pathToFileURL(require.resolve('tsx')).href;
  // 直接执行正式注册处理器及原有客户端边界夹具，不复制一份较弱的验证实现。
  // 客户端是确定性替身：本检查不连接业务数据库、API 或模型，不称为远端 E2E。
  const run = await new Promise((resolve, reject) => {
    // Node 23 起非 TTY 默认输出也变成 spec；明确 TAP，不能把未知计数猜成通过。
    const child = spawn(process.execPath, ['--max-old-space-size=256', '--import', loader, '--test', '--test-reporter=tap', '--test-concurrency=1', ...selectedTests.map(name => 'src/' + name)], {
      cwd: path.join(root, 'microi.mcp'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', timedOut = false, outputLimitExceeded = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, suite === 'full' ? 300000 : 120000);
    child.stdout.on('data', chunk => { if (!outputLimitExceeded) stdout += chunk; if (stdout.length > 4 * 1024 * 1024) { outputLimitExceeded = true; child.kill(); } });
    child.stderr.on('data', chunk => { if (!outputLimitExceeded) stderr += chunk; if (stderr.length > 65536) { outputLimitExceeded = true; child.kill(); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, timedOut, outputLimitExceeded }); });
  });
  const after = await sourceSnapshot();
  const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after) && runnerBefore.equals(await readFile(fileURLToPath(import.meta.url)));
  const dependencyUnchanged = JSON.stringify(dependencyInputs) === JSON.stringify(await hashes(['package.json', 'package-lock.json']));
  const compilerUnchanged = JSON.stringify(compilerInputs) === JSON.stringify(await hashes(['tsconfig.json']));
  const counters = tapResult(run.stdout, run.code, minimumTests);
  return {
    protocolVersion: '1.2.1', suite, evidenceKind: suite === 'full' ? 'public-mcp-offline' : 'registered-handler-contract', startedAt, completedAt: new Date().toISOString(),
    environment: { node: process.version, os: os.platform(), osRelease: os.release(), arch: os.arch() },
    testReporter: 'tap', runner: { file: 'microi.benchmarks/manifest-delivery/verify.mjs', rawSha256: sha256(runnerBefore), lfSha256: sha256(runnerBefore.toString('utf8').replaceAll('\r\n', '\n')) },
    testFiles: selectedTests, minimumTests, sourceTree: treeDigest(before), sources: before, dependencyInputs, compilerInputs,
    inputFiles: ['microi.benchmarks/manifest-delivery/verify.mjs', ...Object.keys(before).map(name => `microi.mcp/src/${name}`), ...Object.keys(dependencyInputs).map(name => `microi.mcp/${name}`), ...Object.keys(compilerInputs).map(name => `microi.mcp/${name}`)].sort(),
    sourceUnchanged, dependencyUnchanged, compilerUnchanged, counters, exitCode: run.code, timedOut: run.timedOut, outputLimitExceeded: run.outputLimitExceeded,
    rawTapSha256: sha256(run.stdout), stderrSha256: sha256(run.stderr),
    failedTestDiagnostics: failureDiagnostics(run.stdout, testSources),
    passed: sourceUnchanged && dependencyUnchanged && compilerUnchanged && counters.passed && !run.timedOut && !run.outputLimitExceeded,
    boundaries: { realProviderCalls: 0, remoteBusinessWrites: 0, databaseExecutionVerified: false, browserVerified: false, certification: false },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index];
      if (!['--out', '--suite'].includes(key) || !args[index + 1] || Object.hasOwn(options, key)) throw new Error('InvalidArgs');
      options[key] = args[index + 1];
    }
    const suite = options['--suite'] ?? 'manifest';
    if (!['manifest', 'full'].includes(suite)) throw new Error('InvalidSuite');
    // 必须先独占占位，不能执行后才发现会覆盖已有结果。
    if (options['--out']) await writeFile(options['--out'], '{"status":"prepared"}\n', { flag: 'wx' });
    const report = await verify({ suite });
    if (options['--out']) await writeFile(options['--out'], JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    // 公共 check-run 注解可直接定位失败；不依赖需要登录下载的原始日志或 Artifact。
    if (process.env.GITHUB_ACTIONS === 'true' && !report.passed)
      for (const annotation of failureAnnotations(report.failedTestDiagnostics)) console.error(annotation);
    process.exitCode = report.passed ? 0 : 1;
  } catch { console.error('声明检查未完成；检查依赖、参数与本地记录。未连接业务或模型服务。'); process.exitCode = 1; }
}
