import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tapResult, failureDiagnostics, failureAnnotations } from './verify.mjs';
const full = '# tests 60\n# pass 60\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
test('完整成功总账与 CRLF 可解析', () => { assert.equal(tapResult(full, 0).passed, true); assert.equal(tapResult(full.replaceAll('\n', '\r\n'), 0).passed, true); });
test('退出失败、计数丢失或双总账不能伪装成功', () => { assert.equal(tapResult(full, 1).passed, false); assert.equal(tapResult(full.replace('# skipped 0\n', ''), 0).passed, false); assert.equal(tapResult(full + full, 0).passed, false); });
test('跳过、待办、取消和失败均拒绝', () => { for (const key of ['fail', 'skipped', 'todo', 'cancelled']) assert.equal(tapResult(full.replace(`# ${key} 0`, `# ${key} 1`), 0).passed, false); });
test('零测试、数量不符与不足责任用例数均拒绝', () => { assert.equal(tapResult(full.replaceAll('60', '0'), 0).passed, false); assert.equal(tapResult(full.replace('# pass 60', '# pass 59'), 0).passed, false); assert.equal(tapResult(full.replaceAll('60', '54'), 0).passed, false); });

const execute = promisify(execFile);
const workspace = fileURLToPath(new URL('../../', import.meta.url));
const manifestTests = ['manifest-preflight.test.ts', 'manifest-context.test.ts', 'manifest-field-relations.test.ts', 'manifest-microservice-module.test.ts', 'advanced-tools-validation-envelope.test.ts'];

// 合成测试只执行 Node 断言并改变指定输入；验证公开运行器证据绑定，不冒充 MCP 业务。
async function fixture(t) {
  const base = path.join(workspace, '.tmp');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'manifest-evidence-runner-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), base);
    await rm(directory, { recursive: true });
  });
  await mkdir(path.join(directory, 'microi.benchmarks/manifest-delivery'), { recursive: true });
  await mkdir(path.join(directory, 'microi.mcp/src'), { recursive: true });
  await mkdir(path.join(directory, 'microi.mcp/node_modules/tsx'), { recursive: true });
  const runner = path.join(directory, 'microi.benchmarks/manifest-delivery/verify.mjs');
  await writeFile(runner, await readFile(new URL('./verify.mjs', import.meta.url)));
  for (const name of ['advanced-tools.ts', 'manifest-preflight.ts', 'manifest-context.ts', 'manifest-context-fixtures.ts', 'design-engine.ts', 'file-upload-config.ts', 'job-runtime-tools.test.ts', ...manifestTests])
    await writeFile(path.join(directory, 'microi.mcp/src', name), 'export {};\n');
  for (const name of manifestTests)
    await writeFile(path.join(directory, 'microi.mcp/src', name), `import test from 'node:test';\nfor (let i=0;i<12;i++) test('fixture '+i,()=>{});\n`);
  await writeFile(path.join(directory, 'microi.mcp/package.json'), '{"type":"module"}\n');
  await writeFile(path.join(directory, 'microi.mcp/package-lock.json'), '{"lockfileVersion":3}\n');
  await writeFile(path.join(directory, 'microi.mcp/tsconfig.json'), '{"compilerOptions":{"module":"Node16"}}\n');
  await writeFile(path.join(directory, 'microi.mcp/node_modules/tsx/package.json'), '{"type":"module","exports":"./loader.mjs"}\n');
  await writeFile(path.join(directory, 'microi.mcp/node_modules/tsx/loader.mjs'), `import {register} from 'node:module'; register('./hook.mjs',import.meta.url);\n`);
  await writeFile(path.join(directory, 'microi.mcp/node_modules/tsx/hook.mjs'), `import {readFile} from 'node:fs/promises'; export async function load(url,context,next){if(url.endsWith('.ts'))return {format:'module',source:await readFile(new URL(url),'utf8'),shortCircuit:true};return next(url,context);}\n`);
  await writeFile(path.join(directory, 'microi.mcp/src/manifest-preflight.test.ts'), `
import test from 'node:test';
import fs from 'node:fs';
const operation = process.env.MICROI_TEST_INPUT_CHANGE;
if (operation === 'source') fs.appendFileSync('src/design-engine.ts', '// changed input\\n');
if (operation === 'add') fs.writeFileSync('src/new-input.ts', 'export {};\\n');
if (operation === 'remove') fs.unlinkSync('src/file-upload-config.ts');
if (operation === 'compiler') fs.writeFileSync('tsconfig.json', '{"compilerOptions":{"module":"NodeNext"}}\\n');
for(let i=0;i<12;i++) test('fixture '+i,()=>{});
`);
  await writeFile(path.join(directory, 'microi.mcp/src/job-runtime-tools.test.ts'), `import test from 'node:test'; const count=process.env.MICROI_TEST_SUITE_COUNT==='355'?295:0; for(let i=0;i<count;i++) test('full fixture '+i,()=>{});\n`);
  await writeFile(path.join(directory, 'microi.mcp/src/manifest-context.test.ts'), `
import test from 'node:test';
for(let i=0;i<12;i++) test('fixture '+i,()=>{});
if(process.env.MICROI_TEST_EVIDENCE_FAILURES){
  test('known failure for evidence',()=>{throw new Error('fixture-secret-error-token');});
  test('dynamic '+process.env.MICROI_TEST_EVIDENCE_FAILURES,()=>{throw new Error('fixture-secret-error-token');});
}
`);
  return { directory, runner };
}

async function invokeFixture(fixture, args = [], changes = {}) {
  let stdout, stderr, exitCode = 0;
  const env = { ...process.env, ...changes };
  // 这是独立 CLI 验收，不能继承 Node 测试 Worker 身份而让子运行器误判为递归测试。
  delete env.NODE_TEST_CONTEXT;
  try {
    ({ stdout, stderr } = await execute(process.execPath, [fixture.runner, ...args], {
      env, windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
    }));
  } catch (error) {
    ({ stdout, stderr } = error); exitCode = error.code;
  }
  return { exitCode, stdout, stderr, report: stdout?.trim().startsWith('{') ? JSON.parse(stdout) : null };
}

test('真实运行器拒绝间接源码、源文件增删及编译配置在测试期间改变', async t => {
  for (const change of ['source', 'add', 'remove', 'compiler']) {
    const created = await fixture(t);
    const result = await invokeFixture(created, [], { MICROI_TEST_INPUT_CHANGE: change });
    assert.equal(result.report?.counters.passed, true, `${change}: 子进程本身通过`);
    assert.equal(result.report?.passed, false, `${change}: 输入变化不得冒充候选不变`);
    assert.equal(result.exitCode, 1);
  }
});

test('完整离线范围从源码发现全部测试并绑定完整成员清单，不依赖易漏项的手工脚本', async t => {
  const created = await fixture(t);
  const result = await invokeFixture(created, ['--suite', 'full'], { MICROI_TEST_SUITE_COUNT: '355' });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.passed, true);
  assert.equal(result.report.evidenceKind, 'public-mcp-offline');
  assert.deepEqual(result.report.testFiles, [...manifestTests, 'job-runtime-tools.test.ts'].sort());
  assert.equal(result.report.sourceTree.fileCount, 12);
  assert.equal(result.report.compilerUnchanged, true);
  assert.match(result.report.sourceTree.rawSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.report.inputFiles.includes('microi.mcp/tsconfig.json'));
  assert.ok(result.report.inputFiles.includes('microi.mcp/src/design-engine.ts'));
  assert.ok(result.report.inputFiles.every(name => !path.isAbsolute(name) && !name.includes('..')));
  assert.equal(result.stdout.includes(created.directory), false, '脱敏结果不含本机绝对路径');
});

test('完整离线范围不能借60项子集冒充通过；未知选项与已有输出仍拒绝', async t => {
  const created = await fixture(t);
  const partial = await invokeFixture(created, ['--suite', 'full']);
  assert.equal(partial.report?.passed, false);
  assert.equal(partial.exitCode, 1);
  assert.notEqual((await invokeFixture(created, ['--suite', 'unknown'])).exitCode, 0);
  const output = path.join(created.directory, 'existing.json');
  await writeFile(output, 'keep existing\n');
  assert.notEqual((await invokeFixture(created, ['--out', output])).exitCode, 0);
  assert.equal(await readFile(output, 'utf8'), 'keep existing\n');
});

test('真实失败只公开已知测试文件与静态标题，动态标题和错误正文不落证据', async t => {
  const created = await fixture(t);
  const result = await invokeFixture(created, [], { MICROI_TEST_EVIDENCE_FAILURES: 'fixture-secret-dynamic-token', GITHUB_ACTIONS: 'true' });
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.counters.fail, 2);
  assert.deepEqual(result.report.failedTestDiagnostics, {
    total: 2, omitted: 0,
    items: [
      { file: 'microi.mcp/src/manifest-context.test.ts', title: 'known failure for evidence' },
      { file: 'microi.mcp/src/manifest-context.test.ts' },
    ],
  });
  assert.equal(result.stdout.includes('fixture-secret'), false);
  assert.equal(result.stdout.includes(created.directory), false);
  assert.ok(result.stderr.includes('::error title=MCP regression::microi.mcp/src/manifest-context.test.ts: known failure for evidence'));
  assert.equal(result.stderr.includes('fixture-secret'), false);
  assert.equal(result.stderr.includes(created.directory), false);
});

test('失败诊断限20项和200字符，未知路径、动态标题、堆栈与错误正文不回显', () => {
  const title = 'public static title '.repeat(20);
  const source = `test('${title}',()=>{}); test('dynamic '+secret,()=>{});`;
  const tap = Array.from({ length: 23 }, (_, index) => `not ok ${index + 1} - ${index === 0 ? title : 'secret-dynamic-value'}\n  ---\n  location: '/private/source/microi.mcp/src/known.test.ts:3:1'\n  message: 'secret-error-value'\n  stack: '/private/home/token'\n  ...\n`).join('');
  const result = failureDiagnostics(tap, { 'known.test.ts': source });
  assert.equal(result.total, 23);
  assert.equal(result.omitted, 3);
  assert.equal(result.items.length, 20);
  assert.equal(result.items[0].title.length, 200);
  assert.ok(result.items.every(item => item.file === 'microi.mcp/src/known.test.ts'));
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('/private'), false);
  assert.deepEqual(failureDiagnostics('not ok 1 - private-title\n  location: /private/unknown.ts:1:1\n', {}), { total: 1, omitted: 0, items: [{ file: null }] });
});

test('GitHub失败注解保留原失败状态且转义命令控制字符', () => {
  assert.deepEqual(failureAnnotations({ items: [{ file: 'microi.mcp/src/known.test.ts', title: '100%\r\n::warning::injected' }, { file: null }] }), [
    '::error title=MCP regression::microi.mcp/src/known.test.ts: 100%25%0D%0A::warning::injected',
    '::error title=MCP regression::Unmapped test failure',
  ]);
});
