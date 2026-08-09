import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'system.manifest.json'), 'utf8'))
const policies = JSON.parse(await readFile(resolve(root, 'resource-policies.json'), 'utf8'))
const byKey = Object.fromEntries(manifest.engines.map((item) => [item.apiEngineKey, item]))

test('治理中心资源数量和业务键稳定', () => {
  assert.equal(manifest.version, 'v2.0.1')
  assert.equal(manifest.tables.length, 40)
  assert.equal(manifest.modules.length, 40)
  assert.equal(manifest.engines.length, 64)
  assert.equal(manifest.jobs.length, 1)
  assert.equal(new Set(manifest.tables.map((item) => item.name)).size, 40)
  assert.equal(new Set(manifest.engines.map((item) => item.apiEngineKey)).size, 64)
  assert.equal(new Set(manifest.modules.map((item) => item.table)).size, 40)
})

test('所有接口都有显式所有权策略', () => {
  for (const engine of manifest.engines) {
    const policy = policies.ApiEngines[engine.apiEngineKey]
    assert.ok(policy, engine.apiEngineKey)
    if (engine.apiEngineKey.endsWith('-extension')) {
      assert.equal(policy.Ownership, 'Tenant')
      assert.equal(policy.UpgradePolicy, 'CreateIfMissing')
    } else {
      assert.equal(policy.Ownership, 'Application')
      assert.equal(policy.UpgradePolicy, 'Managed')
    }
  }
})

test('全部 V8 接口脚本可被 JavaScript 引擎解析', () => {
  for (const engine of manifest.engines) {
    assert.doesNotThrow(() => new Function('V8', 'DateNow', 'System', engine.code), engine.apiEngineKey)
  }
})

test('写入链路包含计划哈希、幂等键或事件Id', () => {
  assert.match(byKey['mci-portal-publish'].code, /ExpectedSnapshotHash/)
  assert.match(byKey['mci-resource-rollback'].code, /ExpectedCurrentHash/)
  assert.match(byKey['mci-identity-sync-apply'].code, /IdempotencyKey/)
  assert.match(byKey['mci-alert-evaluate'].code, /EventId/)
  assert.match(byKey['mci-import-stage'].code, /ExpectedPlanHash/)
  assert.match(byKey['mci-import-execute'].code, /_BackgroundTaskFencingToken/)
  assert.match(byKey['mci-import-rollback'].code, /sameSubset/)
  assert.match(byKey['mci-access-change-apply'].code, /ExpectedPlanHash/)
  assert.match(byKey['mci-access-change-apply'].code, /ExpectedBeforeHash/)
  assert.match(byKey['mci-access-change-rollback'].code, /ExpectedAfterHash/)
  assert.match(byKey['mci-identity-tag-assign'].code, /EvidenceHash/)
  assert.match(byKey['mci-access-request'].code, /ApprovalRef/)
  assert.match(byKey['mci-access-request'].code, /EntitlementKey/)
  assert.match(byKey['mci-access-entitlement-expire'].code, /RoleId/)
  assert.match(byKey['mci-access-entitlement-expire'].code, /Superseded/)
  assert.match(byKey['mci-service-instance-heartbeat'].code, /RowVersion/)
  assert.match(byKey['mci-service-instance-heartbeat'].code, /FencingToken/)
  assert.match(byKey['mci-service-edge-record'].code, /EdgeKey/)
  assert.match(byKey['mci-asset-publish'].code, /ContentHash/)
  assert.match(byKey['mci-collaboration-lease'].code, /FencingToken/)
})

test('导入中心使用持久检查点并拒绝平台核心表与敏感字段', () => {
  assert.match(byKey['mci-import-plan'].code, /protectedTable/)
  assert.match(byKey['mci-import-plan'].code, /sensitiveField/)
  assert.match(byKey['mci-import-execute'].code, /HasMore:\s*true/)
  assert.match(byKey['mci-import-execute'].code, /Checkpoint:\s*\{\s*LastRowNo/)
  assert.match(byKey['mci-import-rollback'].code, /Checkpoint:\s*\{\s*BeforeRowNo/)
  assert.doesNotMatch(byKey['mci-import-execute'].code, /setTimeout|Task\.Run/)
})

test('治理管理接口都包含服务端管理员校验', () => {
  const delegated = new Set([
    'mci-portal-resolve',
    'mci-feature-flag-evaluate',
    'mci-service-instance-heartbeat',
    'mci-service-instance-drain',
    'mci-service-resolve',
    'mci-service-policy-acquire',
    'mci-service-policy-outcome',
    'mci-service-edge-record',
    'mci-asset-resolve',
    'mci-collaboration-lease',
    'mci-alert-dispatch',
    'mci-alert-scan',
    'mci-alert-delivery-send',
    'mci-platform-maintenance'
  ])
  for (const engine of manifest.engines.filter((item) => !item.apiEngineKey.endsWith('-extension') && !delegated.has(item.apiEngineKey))) {
    assert.match(engine.code, /Level\s*\|\|\s*0|Level\s*\|\|\s*['"]0['"]/, engine.apiEngineKey)
    assert.match(engine.code, /9999/, engine.apiEngineKey)
  }
})

test('委托接口需要登录身份或实例令牌，内部任务禁止外部调用', () => {
  for (const key of ['mci-service-instance-heartbeat', 'mci-service-instance-drain', 'mci-service-resolve', 'mci-service-policy-acquire', 'mci-service-policy-outcome', 'mci-service-edge-record', 'mci-asset-resolve', 'mci-collaboration-lease']) {
    assert.match(byKey[key].code, /V8\.CurrentUser/, key)
    assert.equal(byKey[key].allowAnonymous, 0, key)
  }
  assert.match(byKey['mci-service-instance-heartbeat'].code, /TokenHash/)
  assert.match(byKey['mci-service-instance-drain'].code, /InstanceToken/)
  assert.equal(byKey['mci-alert-dispatch'].stopHttp, 1)
  assert.equal(byKey['mci-alert-evaluate'].stopHttp, 1)
  assert.equal(byKey['mci-alert-scan'].stopHttp, 1)
  assert.equal(byKey['mci-alert-delivery-send'].stopHttp, 1)
  assert.equal(byKey['mci-platform-maintenance'].stopHttp, 1)
  assert.match(byKey['mci-platform-maintenance'].code, /MciAiPlatformMinuteSweep/)
  assert.match(byKey['mci-platform-maintenance'].code, /RepairScheduleMetadataAfterQuartzSave/)
  assert.match(byKey['mci-platform-maintenance'].code, /QuartzSaveConfirmed/)
  assert.match(byKey['mci-platform-maintenance'].code, /_InvokeType:\s*'Server'/)
  assert.match(byKey['mci-platform-maintenance'].code, /9999/)
  assert.equal(manifest.jobs[0].ApiEngineKey, 'mci-platform-maintenance')
  assert.equal(manifest.jobs[0].JobName, 'MciAiPlatformMinuteSweep')
})

test('服务治理策略具备发布、精确路由、跨节点限流熔断和持久结果闭环', () => {
  const publish = byKey['mci-service-policy-publish'].code
  const resolveService = byKey['mci-service-resolve'].code
  const acquire = byKey['mci-service-policy-acquire'].code
  const outcome = byKey['mci-service-policy-outcome'].code
  assert.match(publish, /ExpectedContentHash/)
  assert.match(publish, /ContentHash/)
  assert.match(publish, /ResourceType:\s*'ServicePolicy'/)
  assert.match(publish, /DryRun/)
  assert.match(publish, /CircuitJson/)
  assert.doesNotMatch(publish, /Number\(target\.Enabled\s*\|\|\s*1\)/)
  assert.match(resolveService, /TargetsJson/)
  assert.match(resolveService, /labelsMatch/)
  assert.match(resolveService, /versionMatches/)
  assert.match(resolveService, /ContentHash/)
  assert.match(resolveService, /if \(isAdmin\).*Candidates/)
  assert.match(acquire, /SetIfNotExists/)
  assert.match(acquire, /HashIncrement/)
  assert.match(acquire, /Expire/)
  assert.match(acquire, /mci_service_call_outcome/)
  assert.match(acquire, /AppliedTimestamp/)
  assert.match(outcome, /OutcomeKey/)
  assert.match(outcome, /V8\.DbTrans/)
  assert.match(outcome, /mci-service-edge-record/)
  assert.match(outcome, /PersistentOutcomeLedger/)
  const outcomeTable = manifest.tables.find((item) => item.name === 'mci_service_call_outcome')
  assert.ok(outcomeTable)
  assert.ok(outcomeTable.indexes.some((item) => item.name === 'uk_mci_service_call_outcome_permit' && item.unique))
  assert.ok(outcomeTable.indexes.some((item) => item.name === 'idx_mci_service_call_outcome_circuit'))
})

test('配置治理拒绝秘密原文并具备继承摘要和漂移处置闭环', () => {
  const publish = byKey['mci-configuration-publish'].code
  const resolveConfiguration = byKey['mci-configuration-resolve'].code
  const scan = byKey['mci-configuration-drift-scan'].code
  const transition = byKey['mci-configuration-drift-transition'].code
  assert.match(publish, /SecretReferencesJson/)
  assert.match(publish, /sensitiveKey/)
  assert.match(publish, /ExpectedContentHash/)
  assert.match(publish, /ResourceType:\s*'ConfigurationProfile'/)
  assert.match(publish, /DryRun/)
  assert.match(publish, /继承不能超过10层/)
  assert.doesNotMatch(publish, /AESDecrypt|DESDecode|GetText\(/)
  assert.match(resolveConfiguration, /SecretValuesResolved:\s*false/)
  assert.match(resolveConfiguration, /ContentHash/)
  assert.match(resolveConfiguration, /EffectiveHash/)
  assert.doesNotMatch(resolveConfiguration, /TenantSystemSettings|AESDecrypt|DESDecode/)
  assert.match(scan, /Differences/)
  assert.match(scan, /RowVersion/)
  assert.match(transition, /ExpectedRowVersion/)
  assert.match(transition, /摘要仍不一致/)
  const profileTable = manifest.tables.find((item) => item.name === 'mci_configuration_profile')
  const driftTable = manifest.tables.find((item) => item.name === 'mci_configuration_drift')
  assert.ok(profileTable?.indexes.some((item) => item.name === 'uk_mci_configuration_profile_key' && item.unique))
  assert.ok(driftTable?.indexes.some((item) => item.name === 'uk_mci_configuration_drift_key' && item.unique))
})

test('功能开关使用受管版本发布且普通用户不能伪造评估身份', () => {
  const publish = byKey['mci-feature-flag-publish'].code
  const evaluate = byKey['mci-feature-flag-evaluate'].code
  assert.match(publish, /ExpectedContentHash/)
  assert.match(publish, /ResourceType:\s*'FeatureFlag'/)
  assert.match(publish, /DryRun/)
  assert.match(publish, /RowVersion/)
  assert.match(publish, /ExcludedUserIds/)
  assert.match(evaluate, /isAdmin\s*&&\s*requested\.UserId/)
  assert.match(evaluate, /currentUser\.RoleIds/)
  assert.match(evaluate, /currentUser\.DeptIds/)
  assert.match(evaluate, /SubjectKeyHash/)
  assert.match(evaluate, /完整性校验失败/)
  assert.doesNotMatch(evaluate, /context\.RoleIds\s*\|\|\s*V8\.CurrentUser\.RoleIds/)
})

test('发布治理固定计划、不可变审批、门禁和分布式断点执行形成闭环', () => {
  const publish = byKey['mci-release-plan-publish'].code
  const transition = byKey['mci-release-transition'].code
  const validate = byKey['mci-release-validate'].code
  const execute = byKey['mci-release-execute'].code
  assert.match(publish, /ExpectedPlanHash/)
  assert.match(publish, /Object\.keys\(value\)\.sort\(\)/)
  assert.match(publish, /scanSecret/)
  assert.match(publish, /PortalRollback/)
  assert.match(publish, /DryRun/)
  assert.match(publish, /RowVersion/)
  assert.match(transition, /mci_release_approval/)
  assert.match(transition, /ApprovalKey/)
  assert.match(transition, /SeparationOfDuties/)
  assert.match(transition, /ExpectedRowVersion/)
  assert.doesNotMatch(transition, /UptFormData\(['"]mci_release_approval/)
  assert.match(validate, /PlanIntegrity/)
  assert.match(validate, /ApprovalEvidence/)
  assert.match(validate, /NoConfigurationDrift/)
  assert.match(validate, /mci-release-gate-extension/)
  assert.match(execute, /RunKey/)
  assert.match(execute, /IdempotencyKey/)
  assert.match(execute, /LeaseExpiresAt/)
  assert.match(execute, /FencingToken/)
  assert.match(execute, /Checkpoint/)
  assert.match(execute, /ResumeRequired/)
  assert.match(execute, /StepIdempotencyKey/)
  assert.match(execute, /V8\.DbTrans/)
  assert.match(execute, /变更步骤使用独立事务/)
  assert.doesNotMatch(execute, /mci-portal-publish'[^;\n]*V8\.DbTrans/)
  assert.doesNotMatch(execute, /mci-resource-rollback'[^;\n]*V8\.DbTrans/)
  assert.doesNotMatch(execute, /setTimeout|Task\.Run|static\s+/)
  assert.match(byKey['mci-resource-rollback'].code, /目标内容已经是当前发布版本/)
  const approvalTable = manifest.tables.find((item) => item.name === 'mci_release_approval')
  const runTable = manifest.tables.find((item) => item.name === 'mci_release_run')
  assert.ok(approvalTable?.indexes.some((item) => item.name === 'uk_mci_release_approval_key' && item.unique))
  assert.ok(runTable?.indexes.some((item) => item.name === 'uk_mci_release_run_request' && item.unique))
  assert.ok(runTable?.indexes.some((item) => item.name === 'idx_mci_release_run_lease'))
})

test('告警评估使用可信信号、窗口台账和事务后可靠送达', () => {
  const evaluate = byKey['mci-alert-evaluate'].code
  const dispatch = byKey['mci-alert-dispatch'].code
  const sender = byKey['mci-alert-delivery-send'].code
  assert.match(evaluate, /V8\.Method\.QuerySystemLogSignal/)
  assert.match(evaluate, /mci_observability_evaluation/)
  assert.match(evaluate, /ConsecutiveWindows/)
  assert.match(evaluate, /RecoveryWindows/)
  assert.match(evaluate, /expectedRowVersion/)
  assert.match(evaluate, /Suppressed/)
  assert.match(byKey['mci-alert-evaluate-manual'].code, /mci-alert-evaluate/)
  assert.doesNotMatch(dispatch, /mci-alert-notify-extension/)
  assert.match(dispatch, /Status:\s*'Pending'/)
  assert.match(sender, /ClaimToken/)
  assert.match(sender, /LeaseExpiresAt/)
  assert.match(sender, /RowVersion/)
  assert.match(sender, /IdempotencyKey:\s*row\.DeliveryKey/)
  assert.match(sender, /mci-alert-notify-extension/)
  assert.match(byKey['mci-platform-maintenance'].code, /mci-alert-scan/)
  assert.match(byKey['mci-platform-maintenance'].code, /mci-alert-delivery-send/)
})

test('Trace与日志生命周期只调用可信宿主原子能力', () => {
  assert.match(byKey['mci-trace-timeline'].code, /V8\.Method\.GetTraceTimeline/)
  assert.match(byKey['mci-log-lifecycle-plan'].code, /V8\.Method\.PlanSystemLogLifecycle/)
  assert.match(byKey['mci-log-lifecycle-execute'].code, /V8\.Method\.RunSystemLogLifecycle/)
  assert.match(byKey['mci-log-lifecycle-execute'].code, /Checkpoint/)
  assert.doesNotMatch(byKey['mci-log-lifecycle-execute'].code, /V8\.MongoDb\.Del|deleteMany|drop\(/i)
})

test('权限解释复用真实FormEngine授权事实源', () => {
  const source = byKey['mci-permission-explain'].code
  assert.match(source, /V8\.Method\.ExplainAuthorizationDecision/)
  assert.match(source, /TableKey/)
  assert.match(source, /Operation/)
  assert.match(source, /RowId/)
  assert.doesNotMatch(source, /SqlWhere\s*=/)
})

test('租户扩展调用Key与资源策略完全一致', () => {
  const source = manifest.engines.map((item) => item.code).join('\n')
  const calledExtensions = [...source.matchAll(/V8\.ApiEngine\.Run\(['"](mci-[a-z0-9-]+-extension)['"]/g)].map((match) => match[1])
  assert.ok(calledExtensions.length >= 7)
  for (const key of calledExtensions) {
    assert.ok(byKey[key], key)
    assert.equal(policies.ApiEngines[key].UpgradePolicy, 'CreateIfMissing', key)
  }
  assert.doesNotMatch(source, /mci_[a-z0-9_]+_extension/)
})

test('所有内部接口调用都引用当前应用包中声明的稳定Key', () => {
  const declared = new Set(manifest.engines.map((item) => item.apiEngineKey))
  let callCount = 0
  for (const engine of manifest.engines) {
    for (const match of engine.code.matchAll(/V8\.ApiEngine\.Run\(['"]([^'"]+)['"]/g)) {
      callCount += 1
      assert.ok(declared.has(match[1]), `${engine.apiEngineKey} 调用了未声明的接口Key：${match[1]}`)
    }
  }
  assert.ok(callCount >= 16)
})

test('连接器代码不解析密钥原文且新同步账号默认停用', () => {
  const source = manifest.engines.map((item) => item.code).join('\n')
  assert.doesNotMatch(source, /SecretReference\s*\)|AESDecrypt\(|DESDecode\(/)
  assert.match(source, /State:\s*0/)
  assert.match(source, /PasswordCreated:\s*false/)
  assert.match(byKey['mci-identity-sync-plan'].code, /V8\.Method\.ReadIdentityDirectoryPage/)
  assert.match(byKey['mci-identity-sync-plan'].code, /pageCount\s*<\s*5/)
  assert.match(byKey['mci-identity-sync-plan'].code, /SecretResolvedInV8:\s*false/)
})

test('用户组空规则安全失败并支持静态成员和标签集合', () => {
  const source = byKey['mci-identity-group-preview'].code
  assert.match(source, /静态用户组必须.*UserIds/)
  assert.match(source, /MatchAll=true/)
  assert.match(source, /AllTagIds/)
  assert.match(source, /AnyTagIds/)
  assert.match(source, /ExcludeTagIds/)
  assert.match(source, /MemberIds/)
  assert.match(byKey['mci-identity-group-refresh'].code, /preview\.Data\.MemberIds/)
})

test('访问申请状态机与维护任务覆盖临时授权和标签到期', () => {
  const request = byKey['mci-access-request'].code
  assert.match(request, /Submit/)
  assert.match(request, /Approve/)
  assert.match(request, /Reject/)
  assert.match(request, /Cancel/)
  assert.match(request, /Revoke/)
  assert.match(request, /自助审批属于紧急授权/)
  assert.equal(byKey['mci-access-entitlement-expire'].stopHttp, 1)
  assert.match(byKey['mci-platform-maintenance'].code, /mci-access-entitlement-expire/)
  assert.match(byKey['mci-platform-maintenance'].code, /mci_identity_tag_assignment/)
})

test('资产包具备规范化物料协议、DryRun和完整依赖图校验', () => {
  const publish = byKey['mci-asset-publish'].code
  const resolve = byKey['mci-asset-resolve'].code
  assert.match(publish, /microi\.asset\.v1/)
  assert.match(publish, /Manifest\.Platforms/)
  assert.match(publish, /Component\.Name/)
  assert.match(publish, /Setter/)
  assert.match(publish, /DataAdapter/)
  assert.match(publish, /DryRun/)
  assert.match(publish, /DependencyPackages/)
  assert.match(publish, /MinVersion/)
  assert.match(publish, /MaxVersion/)
  assert.match(publish, /资产依赖存在循环/)
  assert.match(publish, /expectedCurrentVersionId/)
  assert.match(publish, /Object\.keys\(value\)\.sort\(\)/)
  assert.match(resolve, /ResolvedDependencies/)
  assert.match(resolve, /LoadOrder/)
  assert.match(resolve, /DependencyGraph/)
  assert.match(resolve, /旧版非规范化摘要/)
})

test('公开应用素材不包含外部平台名称', async () => {
  const texts = [
    await readFile(resolve(root, 'README.md'), 'utf8'),
    await readFile(resolve(root, 'MCI-DESIGN.md'), 'utf8'),
    JSON.stringify(manifest)
  ].join('\n')
  const forbiddenFingerprints = [
    [74, 101, 101, 76, 111, 119, 67, 111, 100, 101],
    [86, 84, 74, 46, 80, 82, 79],
    [110, 101, 119, 103, 97, 116, 101, 119, 97, 121, 47, 118, 116, 106],
    [106, 101, 101, 108, 111, 119, 99, 111, 100, 101, 47, 74, 101, 101, 76, 111, 119, 67, 111, 100, 101]
  ].map((codes) => String.fromCharCode(...codes))
  for (const forbidden of forbiddenFingerprints) {
    assert.equal(texts.includes(forbidden), false, forbidden)
  }
})
