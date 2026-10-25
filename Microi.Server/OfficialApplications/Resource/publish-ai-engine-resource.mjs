// 2026-10-25 中转无限额度专用发行入口：固定运行时/引擎门槛，默认仅生成只读计划。
// 不替代通用平台发行，不自动部署运行时，不设置用户权益，不升级其他官方包。
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as publisher from './mcp-resource-publisher.mjs';
import { validateOfficialPackageChangeLog } from './resource-sync-core.mjs';

export const AI_RESOURCE = 'app.microi.ai-engine.json';
export const TARGET_ENGINE = 'platform-ai-account';
export const CLOSURE = Object.freeze(['form-engine', 'module-engine', 'saas-engine', 'sso', 'store',
  'sys_user', 'sys-config', 'message-notification', 'ai-engine'].map(x => `app.microi.${x}.json`));
const fields = ['Id', 'IsDeleted', 'ApiName', 'ApiEngineKey', 'ApiAddress', 'ApiRoutes', 'IsEnable',
  'ApiV8Code', 'ApiRole', 'AllowAnonymous', 'Files', 'Category', 'EnableLog', 'StopHttp', 'Timeout',
  'MaxStatements', 'LimitMemory', 'LimitRecursion', 'Lock', 'LockKey', 'ResponseFile', 'ResponseType',
  'TestParam', 'ApiRemark', 'V8Limit', 'V8Unlimited', 'Version', 'ChangeHistory'];
const defaults = { IsDeleted: 0, IsEnable: 1, ApiRole: '[]', ApiRoutes: '', AllowAnonymous: 0,
  Files: '[]', Category: '', EnableLog: 0, StopHttp: 0, Timeout: 600, MaxStatements: 100000000,
  LimitMemory: 2048, LimitRecursion: 5000, Lock: 0, LockKey: '', ResponseFile: 0,
  ResponseType: '', TestParam: '', ApiRemark: '', V8Limit: 0, V8Unlimited: 0, ChangeHistory: '' };
const numeric = new Set(Object.keys(defaults).filter(k => typeof defaults[k] === 'number'));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
function fail(code, details = {}) { throw Object.assign(new Error(code), { safeCode: code, details }); }
function validSha(value) { return /^[a-f0-9]{64}$/.test(String(value)); }
function versionParts(value) {
  if (!/^v?\d+\.\d+\.\d+$/.test(String(value))) fail('INVALID_VERSION');
  return String(value).replace(/^v/, '').split('.').map(Number);
}
function compareVersion(a, b) {
  const aa = versionParts(a), bb = versionParts(b);
  return aa[0] - bb[0] || aa[1] - bb[1] || aa[2] - bb[2];
}

export function verifyResource(name, row) {
  if (!row || row.ResourceName !== name || typeof row.Content !== 'string'
      || !validSha(String(row.Sha256).toLowerCase())
      || sha256(row.Content) !== String(row.Sha256).toLowerCase()) fail('RESOURCE_HASH_MISMATCH', { name });
  const model = JSON.parse(row.Content);
  if ((model.PackageInfo?.AppId && model.PackageInfo.AppId !== name.replace(/\.json$/, ''))
      || model.PackageInfo?.Version !== row.AppVersion) fail('RESOURCE_IDENTITY_MISMATCH', { name });
  return { name, content: row.Content, sha256: sha256(row.Content), version: row.AppVersion,
    bytes: Buffer.byteLength(row.Content), model };
}

export function verifyCandidate(content, expectedSha, expectedVersion) {
  if (!validSha(expectedSha) || sha256(content) !== expectedSha) fail('CANDIDATE_HASH_MISMATCH');
  versionParts(expectedVersion);
  const model = JSON.parse(content);
  if ((model.PackageInfo?.AppId && model.PackageInfo.AppId !== 'app.microi.ai-engine') || model.PackageInfo?.Version !== expectedVersion
      || model.PackageInfo?.ServerMinVersion !== '8.7.0') fail('CANDIDATE_VERSION_MISMATCH');
  const account = model.SysApiEngines?.find(x => x.ApiEngineKey === TARGET_ENGINE);
  if (account?.Version !== 'v1.1.1' || !account.ApiV8Code?.includes('RELAY_TOKEN_LIMIT_ADMIN_V1')) {
    fail('CANDIDATE_ENGINE_MISMATCH');
  }
  validateOfficialPackageChangeLog(AI_RESOURCE, content);
  return { name: AI_RESOURCE, content, sha256: expectedSha, version: expectedVersion,
    bytes: Buffer.byteLength(content), model };
}

function comparable(field, value) {
  return numeric.has(field) ? Number(value || 0)
    : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
}
// 与官方控制面的模型归一化一致；报告只保留指纹，不保存源码或用户数据。
export function expectedEngine(source) {
  const output = { Id: source.Id, IsDeleted: 0 };
  for (const field of fields.filter(x => !['Id', 'IsDeleted'].includes(x))) {
    let value = source[field];
    if (field === 'ApiName' && !String(value ?? '')) value = source.Name || source.ApiEngineKey;
    if (field === 'Version' && !String(value ?? '')) value = String(source.ApiV8Code || '').match(/\bVersion\s*:\s*(v?\d+\.\d+\.\d+)\b/i)?.[1] || '';
    if (value == null && Object.hasOwn(defaults, field)) value = defaults[field];
    if (value != null) output[field] = comparable(field, value);
  }
  return output;
}
function engineDiff(actual, expected) {
  return !actual ? ['missing'] : Object.keys(expected)
    .filter(field => comparable(field, actual[field]) !== comparable(field, expected[field]));
}
export function snapshotsFor(resources) {
  const seen = new Set();
  return CLOSURE.map(name => {
    const resource = resources.get(name);
    if (!resource) fail('CLOSURE_MISSING', { name });
    const apiEngines = (resource.model.SysApiEngines || []).map(engine => {
      const key = String(engine.ApiEngineKey || ''), policy = resource.model.ResourcePolicies?.ApiEngines?.[key]?.UpgradePolicy;
      if (!key || seen.has(key.toLowerCase()) || !['Managed', 'CreateIfMissing'].includes(policy)) fail('ENGINE_CLOSURE_INVALID', { name, key });
      seen.add(key.toLowerCase());
      return { engine, policy };
    });
    return { name, sha256: resource.sha256, apiEngines, apiEngineKeys: apiEngines.map(x => x.engine.ApiEngineKey),
      managedCount: apiEngines.filter(x => x.policy === 'Managed').length,
      createIfMissingCount: apiEngines.filter(x => x.policy === 'CreateIfMissing').length };
  });
}
export function auditLive(snapshots, rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = String(row.ApiEngineKey || '').toLowerCase();
    if (!key || byKey.has(key)) fail('LIVE_KEY_DUPLICATE');
    byKey.set(key, row);
  }
  const changes = [], fingerprints = {};
  for (const snapshot of snapshots) for (const { engine, policy } of snapshot.apiEngines) {
    const key = engine.ApiEngineKey, current = byKey.get(key.toLowerCase());
    const expected = expectedEngine(engine);
    const differences = policy === 'Managed' ? engineDiff(current, expected) : current ? [] : ['missing'];
    if (differences.length) changes.push({ key, policy, fields: differences });
    fingerprints[key] = current ? sha256(JSON.stringify(Object.fromEntries(fields.map(f => [f, comparable(f, current[f])])))) : null;
  }
  const count = snapshots.reduce((sum, x) => sum + x.apiEngineKeys.length, 0);
  if (byKey.size > count) fail('LIVE_OUT_OF_SCOPE');
  return { count, changes, fingerprints };
}
function verifyOnlyAccountDelta(oldResource, candidate) {
  const old = oldResource.model, next = candidate.model;
  const keys = new Set([...old.SysApiEngines, ...next.SysApiEngines].map(x => x.ApiEngineKey));
  for (const key of keys) {
    if (key === TARGET_ENGINE) continue;
    if (JSON.stringify(old.SysApiEngines.find(x => x.ApiEngineKey === key)) !== JSON.stringify(next.SysApiEngines.find(x => x.ApiEngineKey === key))
        || JSON.stringify(old.ResourcePolicies.ApiEngines[key]) !== JSON.stringify(next.ResourcePolicies.ApiEngines[key])) fail('NON_TARGET_PACKAGE_ENGINE_CHANGED', { key });
  }
}
function summary(resource) { const { name, version, sha256: hash, bytes } = resource; return { name, version, sha256: hash, bytes }; }
function assertPinned(resources, plan, candidate) {
  if (!Array.isArray(plan.packages) || plan.packages.length !== CLOSURE.length
      || new Set(plan.packages.map(x => x.name)).size !== CLOSURE.length
      || plan.packages.some(x => !CLOSURE.includes(x.name) || !validSha(x.sha256))) fail('PLAN_CLOSURE_INVALID');
  for (const old of plan.packages) {
    const current = resources.get(old.name);
    const allowed = old.name === AI_RESOURCE ? [old.sha256, candidate.sha256] : [old.sha256];
    if (!current || !allowed.includes(current.sha256)) fail('REMOTE_PLAN_DRIFT', { name: old.name });
  }
}
function assertNarrow(audit) {
  const unexpected = audit.changes.filter(x => x.key !== TARGET_ENGINE || x.policy !== 'Managed');
  if (unexpected.length) fail('NON_TARGET_LIVE_DRIFT', { changes: unexpected });
}

export async function runAiRelease({ candidate, phase = 'plan', plan, runtimeConfirmed }, io) {
  if (!['plan', 'publish', 'project'].includes(phase)) fail('INVALID_PHASE');
  const resources = await io.readResources();
  const previous = resources.get(AI_RESOURCE);
  if (previous.sha256 !== candidate.sha256 && compareVersion(previous.version, candidate.version) >= 0) fail('SAME_OR_NEWER_VERSION_DIFFERENT_CONTENT');
  verifyOnlyAccountDelta(previous, candidate);
  if (phase !== 'plan') {
    if (!plan || plan.candidate.sha256 !== candidate.sha256 || plan.candidate.version !== candidate.version) fail('PLAN_CANDIDATE_MISMATCH');
    if (runtimeConfirmed !== '8.7.0') fail('RUNTIME_DEPLOYMENT_CONFIRMATION_REQUIRED');
    assertPinned(resources, plan, candidate);
  }
  const expectedResources = new Map(resources); expectedResources.set(AI_RESOURCE, candidate);
  const snapshots = snapshotsFor(expectedResources);
  const audit = auditLive(snapshots, await io.readLive(snapshots.flatMap(x => x.apiEngineKeys)));
  const result = { schema: 1, phase, checkedAt: new Date().toISOString(),
    official: { apiBase: 'https://api.microi.net', osClient: 'iTdos' }, candidate: summary(candidate),
    packages: CLOSURE.map(name => summary(resources.get(name))), live: audit,
    ready: !audit.changes.some(x => x.key !== TARGET_ENGINE || x.policy !== 'Managed'),
    writesPerformed: false, writeAttempted: false, runtimeDeploymentVerifiedByScript: false,
    concurrencyBoundary: '单包发布只CAS目标AI包，其余8包以前后读检查；投影阶段九包SHA有服务端事务CAS。live接口无预检指纹CAS，事后指纹不防止并发覆盖；执行投影须由发行协调保持管理员编辑静默窗口。' };
  if (phase === 'plan') return result;
  assertNarrow(audit);
  if (phase === 'publish') {
    let mutationFailed = false;
    if (previous.sha256 !== candidate.sha256) {
      result.writeAttempted = true;
      try { await io.publish([{ name: AI_RESOURCE, content: candidate.content, expectedRemoteSha256: previous.sha256 }]); result.writesPerformed = true; }
      catch { mutationFailed = true; }
    }
    // 未知结果只强回读一次，永不自动重复写入。完全命中候选才可恢复为已发布。
    const after = await io.readResources(); assertPinned(after, result, candidate);
    if (after.get(AI_RESOURCE).sha256 !== candidate.sha256) fail(mutationFailed ? 'PUBLISH_UNKNOWN_READBACK_NOT_MATCHED' : 'PUBLISH_READBACK_MISMATCH');
    result.writesPerformed = previous.sha256 !== candidate.sha256;
    result.publish = { matched: true, reused: previous.sha256 === candidate.sha256, recoveredAfterError: mutationFailed };
    result.packages = CLOSURE.map(name => summary(after.get(name)));
    return result;
  }
  if (previous.sha256 !== candidate.sha256) fail('PACKAGE_NOT_PUBLISHED');
  // 本地预检不能为别的管理员并发写入提供隔离；投影期间必须由主发行协调串行。
  const justBefore = await io.readResources(); assertPinned(justBefore, plan, candidate);
  if (justBefore.get(AI_RESOURCE).sha256 !== candidate.sha256) fail('PACKAGE_NOT_PUBLISHED');
  let projection, mutationFailed = false;
  if (audit.changes.length) {
    result.writeAttempted = true;
    try { projection = await io.project(snapshots); result.writesPerformed = true; }
    catch { mutationFailed = true; }
  }
  const after = await io.readResources(); assertPinned(after, plan, candidate);
  if (after.get(AI_RESOURCE).sha256 !== candidate.sha256) fail('PROJECTION_PACKAGE_READBACK_MISMATCH');
  const finalAudit = auditLive(snapshots, await io.readLive(snapshots.flatMap(x => x.apiEngineKeys)));
  if (finalAudit.changes.length) fail(mutationFailed ? 'PROJECTION_UNKNOWN_READBACK_NOT_MATCHED' : 'PROJECTION_READBACK_MISMATCH', { changes: finalAudit.changes });
  for (const [key, fingerprint] of Object.entries(audit.fingerprints)) {
    if (key !== TARGET_ENGINE && finalAudit.fingerprints[key] !== fingerprint) fail('NON_TARGET_LIVE_CHANGED_DURING_PROJECTION', { key });
  }
  result.live = finalAudit;
  result.writesPerformed = audit.changes.length > 0;
  result.projection = { matched: true, reused: !audit.changes.length, recoveredAfterError: mutationFailed,
    verifiedCount: projection?.VerifiedApiEngineCount ?? finalAudit.count };
  return result;
}

async function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--candidate-root', '--expected-sha256', '--expected-version', '--phase', '--plan', '--plan-sha256', '--output', '--confirm-runtime-deployed', '--mcp-config'].includes(args[i]) || !args[i + 1]) fail('INVALID_ARGUMENTS');
    if (Object.hasOwn(options, args[i])) fail('DUPLICATE_ARGUMENT');
    options[args[i]] = args[i + 1];
  }
  if (!isAbsolute(options['--candidate-root'] || '') || !isAbsolute(options['--output'] || '')) fail('ABSOLUTE_CANDIDATE_AND_OUTPUT_REQUIRED');
  const candidatePath = resolve(options['--candidate-root'], 'Microi.Server/OfficialApplications/Resource', AI_RESOURCE);
  const candidate = verifyCandidate(await readFile(candidatePath, 'utf8'), options['--expected-sha256'], options['--expected-version']);
  let plan;
  if (options['--plan']) {
    const raw = await readFile(options['--plan']);
    if (!validSha(options['--plan-sha256']) || sha256(raw) !== options['--plan-sha256']) fail('PLAN_HASH_MISMATCH');
    plan = JSON.parse(raw);
  }
  const transport = { startDirectory: options['--candidate-root'], configPath: options['--mcp-config'] };
  const io = {
    async readResources() {
      const remote = await publisher.readResourcesViaConfiguredMcp(CLOSURE, transport);
      return new Map(CLOSURE.map(name => [name, verifyResource(name, remote.resources.get(name))]));
    },
    async readLive(keys) {
      const rows = [];
      // 固定小批次避免默认分页截断；每批必须完整且没有越界Key，禁止把少读解释为不存在。
      for (let offset = 0; offset < keys.length; offset += 20) {
        const batch = keys.slice(offset, offset + 20);
        const exported = await publisher.exportOfficialPackageViaConfiguredMcp({ ApiEngineKeys: batch, MenuIds: [], TableIds: [], DataSelections: [], AiAppIds: [] }, transport);
        if ((exported.DataSets || []).some(x => (x.Rows || x.Data || []).length)) fail('EXPORT_CONTAINS_BUSINESS_DATA');
        const engines = exported.SysApiEngines || [];
        if (engines.length !== batch.length || engines.some(x => !batch.includes(x.ApiEngineKey))) fail('LIVE_EXPORT_INCOMPLETE');
        rows.push(...engines);
      }
      return rows;
    },
    publish: changes => publisher.publishResourcesViaConfiguredMcp(changes, transport),
    project: snapshots => publisher.reconcilePublishedApiEnginesViaConfiguredMcp(snapshots, transport),
  };
  const result = await runAiRelease({ candidate, phase: options['--phase'] || 'plan', plan,
    runtimeConfirmed: options['--confirm-runtime-deployed'] }, io);
  // 回执不可覆盖，防止一次重跑抹去之前的真实状态；不把服务端错误或源码写入输出。
  const encoded = JSON.stringify(result, null, 2) + '\n';
  await writeFile(options['--output'], encoded, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ phase: result.phase, ready: result.ready, writesPerformed: result.writesPerformed,
    candidate: result.candidate, packageCount: result.packages.length, liveCount: result.live.count,
    changes: result.live.changes, receiptSha256: sha256(encoded) }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ error: error.safeCode || 'MCP_OR_IO_FAILURE', details: error.details || {}, automaticWriteRetry: false }) + '\n');
    process.exitCode = 1;
  });
}
