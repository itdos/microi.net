import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compareContextRuns } from '../../../microi.mcp/scripts/evaluate-context-efficiency.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

test('完整系统保留原八项与菜单报表增补；小改动不以预算代替准确性', () => {
  const workflow = read('microi.skills/microi-system-delivery/references/progressive-01-标准工作流.md');
  const checklist = workflow.slice(workflow.indexOf('## 完整系统开发默认交付清单'), workflow.indexOf('## 菜单先行与经营报表增补要求'));
  for (let number = 1; number <= 8; number++) assert.match(checklist, new RegExp(`### ${number}\\.`));
  for (const phrase of ['菜单先行与经营报表增补要求', '老板经营', '领导管理']) assert.ok(workflow.includes(phrase), phrase);
  const core = read('microi.skills/microi-system-delivery/SKILL.md');
  assert.match(core, /完整系统必须完整读取八项清单及其增补要求/);
  assert.match(core, /未知影响必须扩大检索/);
  const quality = read('microi.skills/microi-system-delivery/references/context-quality.md');
  for (const phrase of ['准确性、权限、业务完整性和验收优先', '目标不唯一', '动态调用', '跨表状态', '完整新系统先完成可遍历', '执行后独立回读', '不通过删测试']) assert.ok(quality.includes(phrase), phrase);
});

test('迁移后的安全与交付正文仍受完整性清单保护，引用路径可达', () => {
  const manifest = JSON.parse(read('microi.skills/.progressive-disclosure-manifest.json'));
  for (const name of ['workspace-conventions', 'microi-system-delivery']) {
    const skill = manifest.skills[name];
    for (const chunk of skill.chunks) {
      const source = read('microi.skills/' + chunk.destination);
      const opening = `<!-- microi-progressive:chunk id=${chunk.id} sha256=${chunk.sha256} -->`;
      const offset = source.indexOf(opening);
      assert.ok(offset >= 0, chunk.id);
      const start = offset + opening.length + (source.startsWith('\r\n', offset + opening.length) ? 2 : 1);
      const end = source.indexOf('<!-- /microi-progressive:chunk -->', start);
      assert.ok(end >= start, chunk.id);
      const raw = source.slice(start, end), lf = raw.replace(/\r\n/g, '\n');
      // Match the canonical validator: Git LF/CRLF conversion is allowed, body changes are not.
      assert.ok([raw, lf, lf.replace(/\n/g, '\r\n')].some(value => hash(value) === chunk.sha256), chunk.id);
    }
    for (const ref of skill.references) assert.ok(fs.existsSync(path.join(root, 'microi.skills', name, ref.path)), ref.path);
  }
  const safety = read('microi.skills/microi-system-delivery/references/progressive-03-安全与跨端验收.md');
  for (const term of ['FormEngine 混合授权', '父记录', 'SSRF', 'Redis 故障', '多节点']) assert.ok(safety.includes(term), term);
  const foundation = read('microi.skills/workspace-conventions/SKILL.md');
  assert.match(foundation, /平台功能四项同步检查/);
  for (const term of ['官方应用商城', '官方中文文档', '吾码 Skills', '吾码 MCP']) assert.ok(foundation.includes(term), term);
});

const contractHash = hash('same output, permissions, dependency coverage and unchanged unrelated data');
const fixture = extra => ({ scenario: 'small-edit', model: 'fixture-model', acceptance: { contractHash, total: 12, passed: 12, failed: 0 }, calls: [{ requestBytes: 10, responseBytes: 90 }], ...extra });

test('载荷节省不能冒充 token 账单，质量退步不可宣称优化成功', () => {
  const result = compareContextRuns(fixture(), fixture({ calls: [{ requestBytes: 10, responseBytes: 10 }] }));
  assert.equal(result.qualityPassed, true);
  assert.equal(result.payload.reductionPercent, 80);
  assert.equal(result.providerUsage.tokenReductionPercent, null);
  const failed = compareContextRuns(fixture(), fixture({ acceptance: { contractHash, total: 12, passed: 11, failed: 1 } }));
  assert.equal(failed.qualityPassed, false);
  assert.equal(failed.payload.reductionPercent, null);
  for (const change of [{ model: 'other' }, { scenario: 'other' }, { acceptance: { contractHash: hash('different'), total: 12, passed: 12, failed: 0 } }]) assert.equal(compareContextRuns(fixture(), fixture(change)).qualityPassed, false);
});

test('真实供应商用量分类保留，缓存和推理子计数不重复累加', () => {
  const result = compareContextRuns(fixture({ usage: { inputTokens: 100, cachedInputTokens: 80, outputTokens: 20, reasoningTokens: 10, cost: 0.1 } }), fixture({ usage: { inputTokens: 50, cachedInputTokens: 40, outputTokens: 10, reasoningTokens: 5, cost: 0.05 } }));
  assert.equal(result.providerUsage.tokenReductionPercent, 50);
  assert.equal(result.providerUsage.candidate.reasoningTokens, 5);
});
