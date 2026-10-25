import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const metricNames = ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens', 'cost'];
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** 只接收计量和验收摘要，绝不把载荷字节换算成供应商账单。 */
export function compareContextRuns(baseline, candidate) {
  const sameTask = typeof baseline.scenario === 'string' && baseline.scenario === candidate.scenario;
  const sameModel = typeof baseline.model === 'string' && baseline.model === candidate.model;
  const contract = baseline.acceptance?.contractHash;
  const sameContract = typeof contract === 'string' && /^[a-f\d]{64}$/i.test(contract) && contract === candidate.acceptance?.contractHash;
  const passed = run => Number.isInteger(run.acceptance?.total) && run.acceptance.total > 0
    && run.acceptance.passed === run.acceptance.total && run.acceptance.failed === 0;
  const qualityPassed = sameTask && sameModel && sameContract && passed(baseline) && passed(candidate)
    && baseline.acceptance.total === candidate.acceptance.total;
  const totals = run => (Array.isArray(run.calls) ? run.calls : []).reduce((sum, call) => ({
    calls: sum.calls + (nonnegative(call.calls) ?? 1),
    errors: sum.errors + (nonnegative(call.errors) ?? 0),
    payloadBytes: sum.payloadBytes + (nonnegative(call.requestBytes) ?? 0) + (nonnegative(call.responseBytes) ?? 0),
  }), { calls: 0, errors: 0, payloadBytes: 0 });
  const a = totals(baseline), b = totals(candidate);
  const provider = run => Object.fromEntries(metricNames.map(name => [name, nonnegative(run.usage?.[name])]));
  const oldUsage = provider(baseline), newUsage = provider(candidate);
  const acceptance = run => ({ contractHash: run.acceptance?.contractHash, total: run.acceptance?.total, passed: run.acceptance?.passed, failed: run.acceptance?.failed });
  // cachedInputTokens 和 reasoningTokens 可能分别包含在 input/output 中，禁止重复相加。
  const tokenTotal = usage => usage.inputTokens !== null && usage.outputTokens !== null ? usage.inputTokens + usage.outputTokens : null;
  const oldTokens = tokenTotal(oldUsage), newTokens = tokenTotal(newUsage);
  const pct = (oldValue, newValue) => qualityPassed && oldValue > 0 && newValue !== null ? Math.round((1 - newValue / oldValue) * 10000) / 100 : null;
  return {
    qualityPassed, sameTask, sameModel, sameContract,
    acceptance: { baseline: acceptance(baseline), candidate: acceptance(candidate) },
    payload: { unit: 'utf8_bytes', baseline: a, candidate: b, reductionPercent: pct(a.payloadBytes, b.payloadBytes) },
    providerUsage: { source: oldTokens === null || newTokens === null ? 'unknown' : 'supplied_usage', baseline: oldUsage, candidate: newUsage, tokenReductionPercent: pct(oldTokens, newTokens) },
    conclusion: !qualityPassed ? '不可比较：任务、模型、验收契约或通过状态不一致。'
      : oldTokens === null || newTokens === null ? '质量契约通过；仅有工具载荷对比，供应商 token 和费用未知。'
      : '质量契约通过；依据导入的供应商 Usage 比较，不据此承诺所有项目固定倍数。',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
  if (!args.includes('--baseline') || !args.includes('--candidate') || !args.includes('--output'))
    throw Error('使用 --baseline <基线.json> --candidate <候选.json> --output <报告.json>；只导入脱敏计量与验收摘要。');
  const report = compareContextRuns(JSON.parse(fs.readFileSync(option('--baseline'), 'utf8')), JSON.parse(fs.readFileSync(option('--candidate'), 'utf8')));
  const destination = path.resolve(option('--output'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ qualityPassed: report.qualityPassed, conclusion: report.conclusion, report: destination }));
  if (!report.qualityPassed) process.exitCode = 1;
}
