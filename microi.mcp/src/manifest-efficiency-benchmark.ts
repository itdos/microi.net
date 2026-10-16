import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalManifestJson } from './manifest-context.js';
import { completeManifest, engineManifest, harness, toolJson } from './manifest-context-fixtures.js';

type JsonRecord = Record<string, unknown>;
type Transcript = { tool: string; input: JsonRecord; output: unknown };

async function runChain(manifest: JsonRecord, strategy: 'full' | 'reference') {
  // 两条链调用相同的正式注册处理器与同一确定性客户端边界；差异只有工具参数和回执格式。
  const run = harness({ legacy: strategy === 'full' });
  const transcript: Transcript[] = [];
  const invoke = async (tool: string, input: JsonRecord) => {
    const output = await run.call(tool, input);
    transcript.push({ tool, input: JSON.parse(JSON.stringify(input)), output });
    assert.notEqual(output.isError, true, `${tool}: ${output.content[0].text}`);
    return output;
  };
  const plan = toolJson(await invoke('microi_plan_system', { manifest, ...(strategy === 'reference' ? { detail: 'summary' } : {}) }));
  const next = strategy === 'reference'
    ? { manifestRef: plan.manifestRef, manifestHash: plan.manifestHash }
    : { manifest };
  if (strategy === 'reference') assert.ok(plan.manifestRef, '引用路径必须由正式 plan handler 返回引用，不能由基准程序伪造');
  const dryRun = toolJson(await invoke('microi_generate_system', { ...next, dryRun: true }));
  assert.deepEqual(dryRun.plan, plan.plan);
  assert.equal(run.calls.length, 0, 'plan/dry-run 不得产生远端读写');
  const generated = toolJson(await invoke('microi_generate_system', { ...next, dryRun: false, confirmExecution: 'tenant' }));
  assert.equal(generated.ok, true);
  assert.equal(generated.validation.Data.Passed, true);
  await invoke('microi_validate_system', next);
  assert.equal(run.calls.filter(call => call.method === 'validateLowCodeSystem').length, 2, '生成和独立验收都必须执行真实客户端验收路径');
  const contract = JSON.parse(JSON.stringify({ clientCalls: run.calls, validation: generated.validation }));
  return {
    metrics: {
      requestBytes: transcript.reduce((sum, call) => sum + Buffer.byteLength(JSON.stringify({ name: call.tool, arguments: call.input }), 'utf8'), 0),
      responseBytes: transcript.reduce((sum, call) => sum + Buffer.byteLength(JSON.stringify(call.output), 'utf8'), 0),
      toolCalls: transcript.length,
      clientCalls: run.calls.length,
      validationCalls: run.calls.filter(call => call.method === 'validateLowCodeSystem').length,
      errors: transcript.filter(call => (call.output as { isError?: boolean }).isError).length,
      passed: generated.validation.Data.Passed,
    },
    contract,
    contractHash: createHash('sha256').update(canonicalManifestJson(contract), 'utf8').digest('hex'),
  };
}

/** 输出为离线 MCP 载荷对照，不把 UTF-8 字节或 mock 验收当作模型账单/远端业务验收。 */
export async function runManifestEfficiencyBenchmark(outputPath?: string) {
  const scenarios: Array<{ id: string; manifest: JsonRecord }> = [
    { id: 'complete-system', manifest: completeManifest },
    { id: 'local-engine-change', manifest: engineManifest },
    { id: 'custom-microservice-module', manifest: { name: '定制前端接入', modules: [{ name: '业务工作台', openType: 'MicroService', microServiceKey: 'biz-ui', microServiceRoutePath: '/overview' }] } },
  ];
  const cases = [];
  for (const scenario of scenarios) {
    const baseline = await runChain(scenario.manifest, 'full');
    const candidate = await runChain(scenario.manifest, 'reference');
    assert.deepEqual(candidate.contract, baseline.contract, `${scenario.id}: 资源动作或最终验收不能为了节省载荷发生变化`);
    assert.equal(candidate.contractHash, baseline.contractHash);
    const baselineTotal = baseline.metrics.requestBytes + baseline.metrics.responseBytes;
    const candidateTotal = candidate.metrics.requestBytes + candidate.metrics.responseBytes;
    // 不伪造“所有任务必省”。小正文在引用开销更大时继续采用全文兼容路径。
    const selected = candidateTotal < baselineTotal ? { strategy: 'reference', ...candidate.metrics } : { strategy: 'full', ...baseline.metrics };
    cases.push({
      id: scenario.id,
      manifestBytes: Buffer.byteLength(JSON.stringify(scenario.manifest), 'utf8'),
      baseline: baseline.metrics,
      candidate: candidate.metrics,
      requestReductionPercent: Number(((1 - candidate.metrics.requestBytes / baseline.metrics.requestBytes) * 100).toFixed(2)),
      totalReductionPercent: Number(((1 - candidateTotal / baselineTotal) * 100).toFixed(2)),
      selected,
      contractHash: baseline.contractHash,
      contractsEqual: true,
    });
  }
  const report = {
    format: 'microi-manifest-efficiency-v1',
    measuredAt: new Date().toISOString(),
    metric: 'UTF-8 bytes of serialized MCP tool arguments and tool results',
    baseline: '当前正式工具的旧全文兼容契约：四阶段均重新传完整 Manifest',
    candidate: '当前正式工具的引用契约：首次正文，后续三个阶段传本会话 ref/hash',
    boundary: '离线 MCP 载荷与确定性客户端协议回归；不是供应商 Token 账单、API 远端业务验收或端到端性能测量。小正文引用可能增加总载荷，应沿用默认全文路径。',
    gates: { sameResourceOperations: true, sameValidationEnvelope: true, independentValidationExecuted: true, failures: 0 },
    cases,
  };
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const report = await runManifestEfficiencyBenchmark(outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
