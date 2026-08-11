import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const now = '2026-08-09 00:00:00'

const option = (items) => ({
  sourceType: 'KeyValue',
  items: items.map(([Key, Value]) => ({ Key, Value }))
})

const field = (name, label, type = 'varchar(200)', component = 'Text', extra = {}) => ({
  name,
  label,
  type,
  component,
  visible: 1,
  appVisible: 1,
  tableWidth: extra.tableWidth ?? 150,
  sort: extra.sort ?? 10,
  ...extra
})

const jsonField = (name, label, sort, tab) => field(name, label, 'longtext', 'CodeEditor', {
  sort,
  tab,
  formWidth: 24,
  description: `${label}，必须为有效 JSON；敏感密钥不得写入。`
})

const table = (name, description, fields, indexes = [], tabs = []) => ({
  name,
  description,
  column: 2,
  v8Unlimited: false,
  ...(tabs.length ? { tabs } : {}),
  fields,
  indexes
})

const tables = [
  table('mci_portal_project', '门户编排项目', [
    field('ProjectKey', '项目Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '项目名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Description', '项目说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 30 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Draft', '草稿'], ['Published', '已发布'], ['Archived', '已归档']]), sort: 40 }),
    jsonField('ThemeJson', '主题配置', 50),
    jsonField('SeoJson', 'SEO配置', 60),
    field('ActiveVersionId', '当前发布版本Id', 'varchar(50)', 'Text', { sort: 70 }),
    field('PublishedHash', '当前发布哈希', 'varchar(100)', 'Text', { sort: 80 }),
    field('PublishedTime', '发布时间', 'varchar(25)', 'DateTime', { sort: 90 })
  ], [
    { name: 'uk_mci_portal_project_key', columns: ['ProjectKey'], unique: true, purpose: '门户项目稳定业务键' },
    { name: 'idx_mci_portal_project_status_update', columns: ['Status', 'UpdateTime'], unique: false, purpose: '门户项目状态列表' }
  ]),
  table('mci_portal_slot', '门户布局插槽', [
    field('ProjectId', '门户项目Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('SlotKey', '插槽Key', 'varchar(100)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Name', '插槽名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 30 }),
    field('LayoutType', '布局类型', 'varchar(50)', 'Select', { configSource: option([['Grid', '网格'], ['Stack', '纵向堆叠'], ['Carousel', '轮播'], ['Tabs', '标签页']]), sort: 40 }),
    jsonField('GridJson', '栅格配置', 50),
    jsonField('VisibilityRuleJson', '可见规则', 60),
    field('Sort', '排序', 'int', 'NumberText', { sort: 70 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 80 })
  ], [
    { name: 'uk_mci_portal_slot_project_key', columns: ['ProjectId', 'SlotKey'], unique: true, purpose: '项目内插槽Key唯一' },
    { name: 'idx_mci_portal_slot_project_sort', columns: ['ProjectId', 'Sort'], unique: false, purpose: '门户渲染顺序' }
  ]),
  table('mci_portal_asset', '门户内容与组件资源', [
    field('ProjectId', '门户项目Id', 'varchar(50)', 'Text', { notEmpty: 1, tab: 'basic', sort: 10 }),
    field('SlotId', '门户插槽Id', 'varchar(50)', 'Text', { notEmpty: 1, tab: 'basic', sort: 20 }),
    field('AssetKey', '资源Key', 'varchar(100)', 'Text', { notEmpty: 1, tab: 'basic', sort: 30 }),
    field('Name', '资源名称', 'varchar(200)', 'Text', { notEmpty: 1, tab: 'basic', sort: 40 }),
    field('AssetType', '资源类型', 'varchar(50)', 'Select', { tab: 'basic', configSource: option([['Hero', '首屏'], ['Navigation', '导航'], ['Card', '卡片'], ['Banner', '横幅'], ['Notice', '公告'], ['Html', '受控HTML'], ['MicroService', '微服务']]), sort: 50 }),
    field('AssetUrl', '资源地址', 'varchar(2000)', 'Text', { tab: 'content', sort: 60 }),
    field('TargetUrl', '跳转地址', 'varchar(2000)', 'Text', { tab: 'content', sort: 70 }),
    jsonField('ContentJson', '结构化内容', 80, 'content'),
    jsonField('VisibilityRuleJson', '可见规则', 90, 'rules'),
    field('StartTime', '开始时间', 'varchar(25)', 'DateTime', { tab: 'rules', sort: 100 }),
    field('EndTime', '结束时间', 'varchar(25)', 'DateTime', { tab: 'rules', sort: 110 }),
    field('Sort', '排序', 'int', 'NumberText', { tab: 'rules', sort: 120 }),
    field('Enabled', '启用', 'int', 'Switch', { tab: 'rules', sort: 130 })
  ], [
    { name: 'uk_mci_portal_asset_project_key', columns: ['ProjectId', 'AssetKey'], unique: true, purpose: '项目内资源Key唯一' },
    { name: 'idx_mci_portal_asset_slot_sort', columns: ['SlotId', 'Sort'], unique: false, purpose: '插槽资源渲染顺序' }
  ], [
    { Id: 'basic', Name: '基础信息', Description: '资源身份、类型及所属插槽', Sort: 10 },
    { Id: 'content', Name: '内容配置', Description: '结构化内容与跳转资源', Sort: 20 },
    { Id: 'rules', Name: '投放规则', Description: '可见范围、有效期和排序', Sort: 30 }
  ]),
  table('mci_resource_version', '平台资源不可变版本', [
    field('ResourceType', '资源类型', 'varchar(50)', 'Select', { configSource: option([['Portal', '门户'], ['Page', '界面'], ['Menu', '模块'], ['ApiEngine', '接口'], ['Blueprint', '蓝图'], ['ServicePolicy', '服务策略'], ['ConfigurationProfile', '配置模板'], ['FeatureFlag', '功能开关']]), notEmpty: 1, sort: 10 }),
    field('ResourceId', '资源Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ResourceKey', '资源Key', 'varchar(200)', 'Text', { sort: 30 }),
    field('VersionNo', '版本号', 'varchar(50)', 'Text', { notEmpty: 1, sort: 40 }),
    field('ContentHash', '内容哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 50 }),
    jsonField('SnapshotJson', '版本快照', 60),
    field('SourceVersionId', '来源版本Id', 'varchar(50)', 'Text', { sort: 70 }),
    field('ChangeSummary', '变更摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 80 }),
    field('Status', '版本状态', 'varchar(50)', 'Select', { configSource: option([['Draft', '草稿'], ['Published', '已发布'], ['Superseded', '已替代']]), sort: 90 }),
    field('PublishedTime', '发布时间', 'varchar(25)', 'DateTime', { sort: 100 })
  ], [
    { name: 'idx_mci_resource_version_hash', columns: ['ResourceType', 'ResourceId', 'ContentHash'], unique: false, purpose: '按内容哈希快速定位历史快照；回滚可基于同一内容创建新的审计版本' },
    { name: 'idx_mci_resource_version_list', columns: ['ResourceType', 'ResourceId', 'CreateTime'], unique: false, purpose: '资源版本时间线' }
  ]),
  table('mci_identity_connector', '身份目录连接器', [
    field('ConnectorKey', '连接器Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '连接器名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ConnectorType', '连接器类型', 'varchar(50)', 'Select', { configSource: option([['Import', '安全导入'], ['LDAP', 'LDAP目录'], ['SCIM', 'SCIM'], ['Custom', '租户扩展']]), sort: 30 }),
    field('Endpoint', '服务地址', 'varchar(2000)', 'Text', { sort: 40 }),
    field('SecretReference', '密钥引用', 'varchar(500)', 'Text', { sort: 50, description: '只保存SaaS引擎或可信密钥服务中的引用，禁止填写密钥原文。' }),
    jsonField('MappingJson', '字段映射', 60),
    jsonField('StrategyJson', '同步策略', 70),
    field('Enabled', '启用', 'int', 'Switch', { sort: 80 }),
    field('LastSyncTime', '最近同步时间', 'varchar(25)', 'DateTime', { sort: 90 })
  ], [
    { name: 'uk_mci_identity_connector_key', columns: ['ConnectorKey'], unique: true, purpose: '连接器稳定业务键' }
  ]),
  table('mci_identity_sync_run', '身份同步运行记录', [
    field('ConnectorId', '连接器Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('IdempotencyKey', '幂等键', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Running', '执行中'], ['Completed', '已完成'], ['CompletedWithConflicts', '完成但有冲突'], ['Failed', '失败']]), sort: 40 }),
    field('StartedTime', '开始时间', 'varchar(25)', 'DateTime', { sort: 50 }),
    field('FinishedTime', '结束时间', 'varchar(25)', 'DateTime', { sort: 60 }),
    field('AddCount', '新增数量', 'int', 'NumberText', { sort: 70 }),
    field('UpdateCount', '更新数量', 'int', 'NumberText', { sort: 80 }),
    field('ConflictCount', '冲突数量', 'int', 'NumberText', { sort: 90 }),
    jsonField('ResultJson', '执行结果', 100)
  ], [
    { name: 'uk_mci_identity_run_idempotency', columns: ['ConnectorId', 'IdempotencyKey'], unique: true, purpose: '跨节点同步请求幂等' },
    { name: 'idx_mci_identity_run_status_time', columns: ['Status', 'CreateTime'], unique: false, purpose: '同步运行查询' }
  ]),
  table('mci_identity_sync_conflict', '身份同步冲突', [
    field('RunId', '运行记录Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('ConnectorId', '连接器Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Account', '账号', 'varchar(255)', 'Text', { sort: 30 }),
    field('ConflictType', '冲突类型', 'varchar(100)', 'Text', { notEmpty: 1, sort: 40 }),
    jsonField('SourceJson', '来源数据', 50),
    field('Message', '冲突说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 60 }),
    field('Status', '处理状态', 'varchar(50)', 'Select', { configSource: option([['Open', '待处理'], ['Resolved', '已解决'], ['Ignored', '已忽略']]), sort: 70 }),
    field('Resolution', '处理结果', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 80 }),
    field('ResolutionUserId', '处理人Id', 'varchar(50)', 'Text', { sort: 90 }),
    field('ResolutionTime', '处理时间', 'varchar(25)', 'DateTime', { sort: 100 })
  ], [
    { name: 'idx_mci_identity_conflict_status_time', columns: ['Status', 'CreateTime'], unique: false, purpose: '待处理冲突队列' },
    { name: 'idx_mci_identity_conflict_run', columns: ['RunId'], unique: false, purpose: '同步运行冲突回查' }
  ]),
  table('mci_configuration_profile', '配置模板、继承与环境基线', [
    field('ProfileKey', '配置Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '配置名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Category', '配置分类', 'varchar(50)', 'Select', { configSource: option([['Business', '业务'], ['Runtime', '运行时'], ['Theme', '主题'], ['Integration', '集成']]), sort: 30 }),
    field('Environment', '环境', 'varchar(50)', 'Select', { configSource: option([['Development', '开发'], ['Test', '测试'], ['Staging', '预发布'], ['Production', '生产']]), sort: 40 }),
    field('ParentProfileId', '父配置Id', 'varchar(50)', 'Text', { sort: 50 }),
    field('VersionNo', '配置版本', 'varchar(50)', 'Text', { notEmpty: 1, sort: 60 }),
    jsonField('SchemaJson', '参数协议', 70),
    jsonField('ValuesJson', '非敏感配置值', 80),
    jsonField('SecretReferencesJson', '敏感值引用', 90),
    field('ContentHash', '内容哈希', 'varchar(100)', 'Text', { sort: 100 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 110 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Published', '已发布'], ['Archived', '已归档']]), sort: 120 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 130 }),
    field('LastValidatedTime', '最近校验时间', 'varchar(25)', 'DateTime', { sort: 140 }),
    field('PublishedTime', '发布时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 160 })
  ], [
    { name: 'uk_mci_configuration_profile_key', columns: ['ProfileKey'], unique: true, purpose: '配置模板稳定业务键' },
    { name: 'idx_mci_configuration_profile_env', columns: ['Environment', 'Status', 'Enabled', 'UpdateTime'], unique: false, purpose: '按环境解析发布配置' },
    { name: 'idx_mci_configuration_profile_parent', columns: ['ParentProfileId'], unique: false, purpose: '继承链影响查询' }
  ]),
  table('mci_configuration_drift', '配置基线漂移巡检', [
    field('DriftKey', '漂移Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('BaselineProfileId', '基线配置Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('TargetProfileId', '目标配置Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Environment', '目标环境', 'varchar(50)', 'Text', { sort: 40 }),
    field('BaselineHash', '基线摘要', 'varchar(100)', 'Text', { sort: 50 }),
    field('ActualHash', '实际摘要', 'varchar(100)', 'Text', { sort: 60 }),
    field('Status', '漂移状态', 'varchar(50)', 'Select', { configSource: option([['Matched', '一致'], ['Changed', '已漂移'], ['Ignored', '已忽略'], ['Resolved', '已修复']]), sort: 70 }),
    jsonField('DiffJson', '语义差异', 80),
    field('IgnoredReason', '忽略原因', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 90 }),
    field('DetectedTime', '发现时间', 'varchar(25)', 'DateTime', { sort: 100 }),
    field('ResolvedTime', '处理时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 120 })
  ], [
    { name: 'uk_mci_configuration_drift_key', columns: ['DriftKey'], unique: true, purpose: '同一基线与目标只保留最新漂移事实' },
    { name: 'idx_mci_configuration_drift_status', columns: ['Status', 'DetectedTime'], unique: false, purpose: '活动漂移巡检队列' },
    { name: 'idx_mci_configuration_drift_target', columns: ['TargetProfileId', 'DetectedTime'], unique: false, purpose: '目标配置漂移时间线' }
  ]),
  table('mci_feature_flag', '功能开关与稳定灰度', [
    field('FlagKey', '开关Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '开关名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Description', '开关说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 30 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 40 }),
    field('Percentage', '灰度百分比', 'int', 'NumberText', { sort: 50, description: '0-100，按开关Key和主体Key稳定分桶。' }),
    field('Variant', '启用变体', 'varchar(100)', 'Text', { sort: 60 }),
    jsonField('RulesJson', '定向规则', 70),
    field('StartTime', '开始时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('EndTime', '结束时间', 'varchar(25)', 'DateTime', { sort: 90 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 100 }),
    field('VersionNo', '开关版本', 'varchar(50)', 'Text', { sort: 110 }),
    field('ContentHash', '内容哈希', 'varchar(100)', 'Text', { sort: 120 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 130 }),
    field('LastValidatedTime', '最近校验时间', 'varchar(25)', 'DateTime', { sort: 140 })
  ], [
    { name: 'uk_mci_feature_flag_key', columns: ['FlagKey'], unique: true, purpose: '功能开关稳定业务键' },
    { name: 'idx_mci_feature_flag_enabled_time', columns: ['Enabled', 'StartTime', 'EndTime'], unique: false, purpose: '活动开关查询' }
  ]),
  table('mci_release_plan', '发布计划与质量门禁', [
    field('ReleaseKey', '发布Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '发布名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('VersionNo', '版本号', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Environment', '环境', 'varchar(50)', 'Select', { configSource: option([['Development', '开发'], ['Test', '测试'], ['Staging', '预发布'], ['Production', '生产']]), sort: 40 }),
    field('PortalProjectId', '门户项目Id', 'varchar(50)', 'Text', { sort: 50 }),
    jsonField('GatesJson', '门禁规则', 60),
    jsonField('ResourcesJson', '发布资源步骤', 65),
    jsonField('RollbackJson', '回滚资源步骤', 66),
    jsonField('ApprovalPolicyJson', '审批策略', 67),
    jsonField('EvidenceJson', '测试与回读证据', 68),
    field('PlanHash', '发布计划哈希', 'varchar(100)', 'Text', { sort: 69 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Draft', '草稿'], ['Reviewing', '审批中'], ['Approved', '已批准'], ['Checking', '检查中'], ['Blocked', '已阻断'], ['Ready', '可发布'], ['Releasing', '发布中'], ['Released', '已发布'], ['Failed', '失败'], ['Rejected', '已驳回'], ['Cancelled', '已取消'], ['RollingBack', '回滚中'], ['RolledBack', '已回滚']]), sort: 70 }),
    field('LastCheckTime', '最近检查时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    jsonField('LastCheckJson', '最近检查结果', 90),
    field('ChangeSummary', '变更摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 100 }),
    field('ReviewRound', '审批轮次', 'int', 'NumberText', { sort: 110 }),
    field('ApprovedBy', '批准人摘要', 'varchar(2000)', 'Text', { sort: 120 }),
    field('ApprovalTime', '批准时间', 'varchar(25)', 'DateTime', { sort: 130 }),
    field('LastRunId', '最近运行Id', 'varchar(50)', 'Text', { sort: 140 }),
    field('ReleasedTime', '发布时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 160 })
  ], [
    { name: 'uk_mci_release_plan_key', columns: ['ReleaseKey'], unique: true, purpose: '发布计划稳定业务键' },
    { name: 'idx_mci_release_plan_status_time', columns: ['Status', 'UpdateTime'], unique: false, purpose: '发布看板' }
  ]),
  table('mci_release_approval', '发布审批不可变证据', [
    field('ApprovalKey', '审批Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('ReleasePlanId', '发布计划Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('ReviewRound', '审批轮次', 'int', 'NumberText', { sort: 40 }),
    field('ApproverUserId', '审批人Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 50 }),
    field('ApproverName', '审批人', 'varchar(200)', 'Text', { sort: 60 }),
    field('Decision', '审批结论', 'varchar(50)', 'Select', { configSource: option([['Approve', '同意'], ['Reject', '驳回']]), sort: 70 }),
    field('Comment', '审批意见', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 80 }),
    field('DecisionTime', '审批时间', 'varchar(25)', 'DateTime', { sort: 90 })
  ], [
    { name: 'uk_mci_release_approval_key', columns: ['ApprovalKey'], unique: true, purpose: '同轮同一审批人只决策一次' },
    { name: 'idx_mci_release_approval_plan', columns: ['ReleasePlanId', 'ReviewRound', 'DecisionTime'], unique: false, purpose: '发布审批证据时间线' }
  ]),
  table('mci_release_run', '发布与回滚断点运行台账', [
    field('RunKey', '运行Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('ReleasePlanId', '发布计划Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('IdempotencyKey', '幂等键', 'varchar(160)', 'Text', { notEmpty: 1, sort: 30 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 40 }),
    field('Direction', '方向', 'varchar(50)', 'Select', { configSource: option([['Release', '发布'], ['Rollback', '回滚']]), sort: 50 }),
    field('Status', '运行状态', 'varchar(50)', 'Select', { configSource: option([['Running', '执行中'], ['Completed', '已完成'], ['Failed', '失败']]), sort: 60 }),
    field('Checkpoint', '断点序号', 'int', 'NumberText', { sort: 70 }),
    field('TotalSteps', '总步骤数', 'int', 'NumberText', { sort: 80 }),
    jsonField('ResultsJson', '步骤结果', 90),
    field('LeaseOwner', '租约持有者', 'varchar(100)', 'Text', { sort: 100 }),
    field('LeaseToken', '租约令牌', 'varchar(100)', 'Text', { sort: 110 }),
    field('LeaseExpiresAt', '租约到期时间', 'varchar(25)', 'DateTime', { sort: 120 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { sort: 130 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 140 }),
    field('StartedTime', '开始时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('FinishedTime', '完成时间', 'varchar(25)', 'DateTime', { sort: 160 }),
    field('ErrorMessage', '错误摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 170 })
  ], [
    { name: 'uk_mci_release_run_key', columns: ['RunKey'], unique: true, purpose: '发布/回滚请求幂等运行Key' },
    { name: 'uk_mci_release_run_request', columns: ['ReleasePlanId', 'Direction', 'IdempotencyKey'], unique: true, purpose: '同计划同方向请求只运行一次' },
    { name: 'idx_mci_release_run_lease', columns: ['Status', 'LeaseExpiresAt'], unique: false, purpose: '跨节点过期租约恢复' },
    { name: 'idx_mci_release_run_plan', columns: ['ReleasePlanId', 'StartedTime'], unique: false, purpose: '发布运行时间线' }
  ]),
  table('mci_service_registry', '服务目录与依赖登记', [
    field('ServiceKey', '服务Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '服务名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ServiceType', '服务类型', 'varchar(50)', 'Select', { configSource: option([['Api', 'API'], ['Worker', '后台任务'], ['MicroService', '前端微服务'], ['Database', '数据库'], ['External', '外部服务']]), sort: 30 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 40 }),
    field('Environment', '环境', 'varchar(50)', 'Select', { configSource: option([['Development', '开发'], ['Test', '测试'], ['Staging', '预发布'], ['Production', '生产']]), sort: 50 }),
    field('BaseUrl', '基础地址', 'varchar(2000)', 'Text', { sort: 60 }),
    field('HealthPath', '健康检查路径', 'varchar(500)', 'Text', { sort: 70 }),
    jsonField('DependenciesJson', '依赖关系', 80),
    field('HealthState', '健康状态', 'varchar(50)', 'Select', { configSource: option([['Healthy', '健康'], ['Degraded', '降级'], ['Down', '故障'], ['Unknown', '未知']]), sort: 90 }),
    field('LastSeenTime', '最近心跳时间', 'varchar(25)', 'DateTime', { sort: 100 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 110 })
  ], [
    { name: 'uk_mci_service_registry_key', columns: ['ServiceKey'], unique: true, purpose: '服务稳定业务键' },
    { name: 'idx_mci_service_health_env', columns: ['Environment', 'HealthState', 'UpdateTime'], unique: false, purpose: '环境健康视图' }
  ]),
  table('mci_observability_policy', '可观测指标与阈值策略', [
    field('PolicyKey', '策略Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '策略名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ServiceId', '服务Id', 'varchar(50)', 'Text', { sort: 30 }),
    field('MetricName', '指标名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 40 }),
    field('Operator', '比较符', 'varchar(20)', 'Select', { configSource: option([['>', '>'], ['>=', '>='], ['<', '<'], ['<=', '<='], ['=', '='], ['<>', '<>']]), sort: 50 }),
    field('Threshold', '阈值', 'decimal(18,4)', 'NumberText', { sort: 60 }),
    field('WindowSeconds', '观察窗口秒数', 'int', 'NumberText', { sort: 70 }),
    field('Severity', '告警级别', 'varchar(50)', 'Select', { configSource: option([['Info', '提示'], ['Warning', '警告'], ['High', '高危'], ['Critical', '严重']]), sort: 80 }),
    field('EvaluationMode', '评估模式', 'varchar(50)', 'Select', { configSource: option([['Push', '事件推送'], ['Job', '定时任务'], ['Manual', '手工验证']]), sort: 90 }),
    jsonField('QueryJson', '指标查询配置', 100),
    field('ConsecutiveWindows', '连续触发窗口', 'int', 'NumberText', { sort: 110 }),
    field('RecoveryWindows', '连续恢复窗口', 'int', 'NumberText', { sort: 120 }),
    field('SuppressSeconds', '抑制秒数', 'int', 'NumberText', { sort: 130 }),
    field('LastWindowKey', '最近窗口Key', 'varchar(160)', 'Text', { sort: 140 }),
    field('LastObservedValue', '最近观测值', 'decimal(18,6)', 'NumberText', { sort: 150 }),
    field('ConsecutiveTriggerCount', '连续触发次数', 'int', 'NumberText', { sort: 160 }),
    field('ConsecutiveRecoveryCount', '连续恢复次数', 'int', 'NumberText', { sort: 170 }),
    field('ActiveEventId', '活动告警Id', 'varchar(50)', 'Text', { sort: 180 }),
    field('LastEvaluationTime', '最近评估时间', 'varchar(25)', 'DateTime', { sort: 190 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 200 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 210 })
  ], [
    { name: 'uk_mci_observability_policy_key', columns: ['PolicyKey'], unique: true, purpose: '策略稳定业务键' },
    { name: 'idx_mci_observability_policy_service', columns: ['ServiceId', 'Enabled'], unique: false, purpose: '服务策略查询' },
    { name: 'idx_mci_observability_policy_job', columns: ['EvaluationMode', 'Enabled', 'LastEvaluationTime'], unique: false, purpose: '定时规则扫描' }
  ]),
  table('mci_alert_event', '平台告警事件', [
    field('EventId', '事件Id', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('PolicyId', '策略Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ServiceId', '服务Id', 'varchar(50)', 'Text', { sort: 30 }),
    field('Title', '告警标题', 'varchar(500)', 'Text', { notEmpty: 1, sort: 40 }),
    field('Severity', '告警级别', 'varchar(50)', 'Select', { configSource: option([['Info', '提示'], ['Warning', '警告'], ['High', '高危'], ['Critical', '严重']]), sort: 50 }),
    field('Status', '处理状态', 'varchar(50)', 'Select', { configSource: option([['New', '新告警'], ['Acknowledged', '已确认'], ['Resolved', '已解决'], ['Closed', '已关闭']]), sort: 60 }),
    field('ObservedValue', '观测值', 'decimal(18,4)', 'NumberText', { sort: 70 }),
    field('Threshold', '阈值', 'decimal(18,4)', 'NumberText', { sort: 80 }),
    jsonField('ContextJson', '事件上下文', 90),
    field('FirstSeenTime', '首次发现时间', 'varchar(25)', 'DateTime', { sort: 100 }),
    field('LastSeenTime', '最近发现时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('AcknowledgeUserId', '确认人Id', 'varchar(50)', 'Text', { sort: 120 }),
    field('AcknowledgeTime', '确认时间', 'varchar(25)', 'DateTime', { sort: 130 }),
    field('Resolution', '处置说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 140 }),
    field('DedupKey', '去重Key', 'varchar(200)', 'Text', { sort: 150 }),
    field('TriggerCount', '触发次数', 'int', 'NumberText', { sort: 160 }),
    field('RecoveryTime', '恢复时间', 'varchar(25)', 'DateTime', { sort: 170 })
  ], [
    { name: 'uk_mci_alert_event_id', columns: ['EventId'], unique: true, purpose: '跨节点告警事件幂等' },
    { name: 'idx_mci_alert_status_severity', columns: ['Status', 'Severity', 'CreateTime'], unique: false, purpose: '活动告警队列' },
    { name: 'idx_mci_alert_policy_time', columns: ['PolicyId', 'CreateTime'], unique: false, purpose: '策略告警时间线' },
    { name: 'idx_mci_alert_dedup_status', columns: ['DedupKey', 'Status', 'LastSeenTime'], unique: false, purpose: '活动告警聚合与恢复' }
  ]),
  table('mci_observability_evaluation', '告警规则窗口评估台账', [
    field('EvaluationKey', '评估Key', 'varchar(220)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('PolicyId', '策略Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('WindowKey', '窗口Key', 'varchar(160)', 'Text', { notEmpty: 1, sort: 30 }),
    field('SignalType', '信号类型', 'varchar(50)', 'Text', { sort: 40 }),
    field('ObservedValue', '观测值', 'decimal(18,6)', 'NumberText', { sort: 50 }),
    field('Triggered', '是否触发', 'int', 'Switch', { sort: 60 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Running', '评估中'], ['Completed', '已完成'], ['Failed', '失败']]), sort: 70 }),
    jsonField('MetricsJson', '聚合信号', 80),
    field('AlertId', '告警Id', 'varchar(50)', 'Text', { sort: 90 }),
    field('ErrorMessage', '错误说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 100 }),
    field('EvaluatedTime', '评估时间', 'varchar(25)', 'DateTime', { sort: 110 })
  ], [
    { name: 'uk_mci_observability_evaluation_key', columns: ['EvaluationKey'], unique: true, purpose: '同一策略窗口跨节点只评估一次' },
    { name: 'idx_mci_observability_evaluation_policy', columns: ['PolicyId', 'EvaluatedTime'], unique: false, purpose: '策略评估历史' },
    { name: 'idx_mci_observability_evaluation_status', columns: ['Status', 'CreateTime'], unique: false, purpose: '失败评估巡检' }
  ]),
  table('mci_import_job', '可恢复导入批次', [
    field('ImportKey', '导入批次Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('IdempotencyKey', '幂等键', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('TargetTable', '目标表', 'varchar(255)', 'Text', { notEmpty: 1, sort: 30 }),
    field('FileName', '来源文件名', 'varchar(500)', 'Text', { sort: 40 }),
    field('FileHash', '来源文件哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 50 }),
    field('PlanHash', '预检计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 60 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Staged', '已暂存'], ['Running', '处理中'], ['Paused', '已暂停'], ['Completed', '已完成'], ['CompletedWithErrors', '完成但有错误'], ['Cancelled', '已取消'], ['RollingBack', '回滚中'], ['RolledBack', '已回滚'], ['Failed', '失败']]), sort: 70 }),
    field('TotalCount', '总行数', 'int', 'NumberText', { sort: 80 }),
    field('SuccessCount', '成功数', 'int', 'NumberText', { sort: 90 }),
    field('FailedCount', '失败数', 'int', 'NumberText', { sort: 100 }),
    field('RolledBackCount', '回滚数', 'int', 'NumberText', { sort: 110 }),
    field('ChunkSize', '分片行数', 'int', 'NumberText', { sort: 120, description: '每个后台任务事务片段处理的行数，范围1-200。' }),
    jsonField('MappingJson', '字段映射', 130),
    field('BackgroundTaskId', '后台任务Id', 'varchar(100)', 'Text', { sort: 140 }),
    field('BackgroundTaskFencingToken', '任务栅栏令牌', 'bigint', 'NumberText', { sort: 150 }),
    field('Progress', '真实进度', 'int', 'NumberText', { sort: 160 }),
    field('EstimatedEndTime', '预计结束时间', 'varchar(25)', 'DateTime', { sort: 170 }),
    field('StartedTime', '开始时间', 'varchar(25)', 'DateTime', { sort: 180 }),
    field('FinishedTime', '结束时间', 'varchar(25)', 'DateTime', { sort: 190 }),
    field('LastError', '最近错误', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 200 }),
    jsonField('ResultJson', '结果摘要', 210)
  ], [
    { name: 'uk_mci_import_job_key', columns: ['ImportKey'], unique: true, purpose: '导入批次稳定业务键' },
    { name: 'uk_mci_import_job_idempotency', columns: ['IdempotencyKey'], unique: true, purpose: '重复提交幂等' },
    { name: 'idx_mci_import_job_status_time', columns: ['Status', 'UpdateTime'], unique: false, purpose: '可恢复批次扫描' }
  ]),
  table('mci_import_row', '可恢复导入暂存行', [
    field('JobId', '导入批次Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('RowNo', '来源行号', 'int', 'NumberText', { notEmpty: 1, sort: 20 }),
    field('RowHash', '行内容哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Pending', '待处理'], ['Succeeded', '成功'], ['Failed', '失败'], ['Skipped', '跳过'], ['RolledBack', '已回滚']]), sort: 40 }),
    field('Action', '动作', 'varchar(50)', 'Select', { configSource: option([['Add', '新增'], ['Update', '更新'], ['Skip', '跳过']]), sort: 50 }),
    jsonField('SourceJson', '来源数据', 60),
    jsonField('NormalizedJson', '规范化数据', 70),
    field('TargetId', '目标数据Id', 'varchar(50)', 'Text', { sort: 80 }),
    jsonField('BeforeJson', '变更前快照', 90),
    jsonField('AfterJson', '变更后快照', 100),
    field('ErrorCode', '错误代码', 'varchar(100)', 'Text', { sort: 110 }),
    field('ErrorMessage', '错误说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 120 }),
    field('FencingToken', '执行栅栏令牌', 'bigint', 'NumberText', { sort: 130 }),
    field('AppliedTime', '执行时间', 'varchar(25)', 'DateTime', { sort: 140 }),
    field('RolledBackTime', '回滚时间', 'varchar(25)', 'DateTime', { sort: 150 })
  ], [
    { name: 'uk_mci_import_row_job_no', columns: ['JobId', 'RowNo'], unique: true, purpose: '批次内每一来源行唯一' },
    { name: 'idx_mci_import_row_job_status_no', columns: ['JobId', 'Status', 'RowNo'], unique: false, purpose: '分片执行和失败修正' },
    { name: 'idx_mci_import_row_target', columns: ['JobId', 'TargetId'], unique: false, purpose: '回滚目标定位' }
  ]),
  table('mci_identity_group', '动态用户组与人群规则', [
    field('GroupKey', '用户组Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '用户组名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('GroupType', '用户组类型', 'varchar(50)', 'Select', { configSource: option([['Static', '静态组'], ['Dynamic', '动态组'], ['Directory', '目录同步组']]), sort: 30 }),
    jsonField('RuleJson', '安全人群规则', 40),
    field('RuleHash', '规则哈希', 'varchar(100)', 'Text', { sort: 50 }),
    field('ActiveSnapshotId', '生效快照Id', 'varchar(50)', 'Text', { sort: 60 }),
    field('MemberCount', '成员数量', 'int', 'NumberText', { sort: 70 }),
    field('LastEvaluatedTime', '最近评估时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 90 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 100 })
  ], [
    { name: 'uk_mci_identity_group_key', columns: ['GroupKey'], unique: true, purpose: '用户组稳定业务键' },
    { name: 'idx_mci_identity_group_enabled_time', columns: ['Enabled', 'LastEvaluatedTime'], unique: false, purpose: '动态组周期评估' }
  ]),
  table('mci_identity_group_member', '用户组不可变成员快照', [
    field('GroupId', '用户组Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('SnapshotId', '成员快照Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('UserId', '用户Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Account', '账号', 'varchar(255)', 'Text', { sort: 40 }),
    field('MembershipSource', '成员来源', 'varchar(50)', 'Select', { configSource: option([['Static', '静态'], ['Rule', '规则'], ['Directory', '目录']]), sort: 50 }),
    field('MembershipHash', '成员证据哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 60 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Active', '生效'], ['Superseded', '已替代']]), sort: 70 }),
    field('EffectiveFrom', '生效时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('EffectiveTo', '失效时间', 'varchar(25)', 'DateTime', { sort: 90 })
  ], [
    { name: 'uk_mci_identity_group_snapshot_user', columns: ['GroupId', 'SnapshotId', 'UserId'], unique: true, purpose: '同一成员快照内用户唯一' },
    { name: 'idx_mci_identity_group_member_active', columns: ['GroupId', 'Status', 'UserId'], unique: false, purpose: '当前成员查询' }
  ]),
  table('mci_identity_tag', '用户标签字典', [
    field('TagKey', '标签Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '标签名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Category', '标签分类', 'varchar(100)', 'Text', { sort: 30 }),
    field('ValueType', '值类型', 'varchar(50)', 'Select', { configSource: option([['Boolean', '布尔'], ['String', '文本'], ['Number', '数值'], ['Json', 'JSON']]), sort: 40 }),
    field('Scope', '作用域', 'varchar(50)', 'Select', { configSource: option([['Tenant', '租户'], ['Application', '应用'], ['Directory', '目录']]), sort: 50 }),
    field('Color', '标签颜色', 'varchar(50)', 'Text', { sort: 60 }),
    field('Description', '标签说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 70 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 80 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 90 })
  ], [
    { name: 'uk_mci_identity_tag_key', columns: ['TagKey'], unique: true, purpose: '用户标签稳定业务键' },
    { name: 'idx_mci_identity_tag_category_enabled', columns: ['Category', 'Enabled', 'UpdateTime'], unique: false, purpose: '标签目录检索' }
  ]),
  table('mci_identity_tag_assignment', '用户标签分配与有效期证据', [
    field('AssignmentKey', '分配Key', 'varchar(220)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('TagId', '标签Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('UserId', '用户Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Account', '账号', 'varchar(255)', 'Text', { sort: 40 }),
    jsonField('ValueJson', '标签值', 50),
    field('SourceType', '来源', 'varchar(50)', 'Select', { configSource: option([['Manual', '手工'], ['Directory', '目录'], ['Rule', '规则'], ['Application', '应用']]), sort: 60 }),
    field('SourceRef', '来源引用', 'varchar(500)', 'Text', { sort: 70 }),
    field('EffectiveFrom', '生效时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('ExpiresAt', '到期时间', 'varchar(25)', 'DateTime', { sort: 90 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Active', '生效'], ['Revoked', '已撤销'], ['Expired', '已到期']]), sort: 100 }),
    field('EvidenceHash', '证据哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 110 }),
    field('AssignedBy', '分配人', 'varchar(200)', 'Text', { sort: 120 }),
    field('RevokedTime', '撤销时间', 'varchar(25)', 'DateTime', { sort: 130 })
  ], [
    { name: 'uk_mci_identity_tag_assignment_key', columns: ['AssignmentKey'], unique: true, purpose: '同一标签与用户只有一个当前事实源' },
    { name: 'idx_mci_identity_tag_user_status', columns: ['TagId', 'UserId', 'Status'], unique: false, purpose: '人群规则标签解析' },
    { name: 'idx_mci_identity_tag_expiry', columns: ['Status', 'ExpiresAt'], unique: false, purpose: '标签到期扫描' }
  ]),
  table('mci_access_change_set', '批量授权变更集', [
    field('ChangeKey', '变更Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('IdempotencyKey', '幂等键', 'varchar(200)', 'Text', { notEmpty: 1, unique: 1, sort: 20 }),
    field('ActionType', '动作类型', 'varchar(50)', 'Select', { configSource: option([['GrantRole', '授予角色'], ['RevokeRole', '移除角色'], ['ReplaceRoles', '替换角色']]), sort: 30 }),
    field('TargetType', '目标类型', 'varchar(50)', 'Select', { configSource: option([['Users', '用户'], ['Group', '用户组']]), sort: 40 }),
    field('TargetId', '目标Id', 'varchar(50)', 'Text', { sort: 50 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 60 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Planned', '已计划'], ['Applying', '执行中'], ['Applied', '已应用'], ['PartiallyApplied', '部分应用'], ['RollingBack', '回滚中'], ['RolledBack', '已回滚'], ['RollbackConflicts', '回滚冲突'], ['Failed', '失败']]), sort: 70 }),
    field('RequestedBy', '申请人', 'varchar(200)', 'Text', { sort: 80 }),
    field('ApprovalRef', '审批引用', 'varchar(200)', 'Text', { sort: 90 }),
    field('TotalCount', '总数', 'int', 'NumberText', { sort: 100 }),
    field('SuccessCount', '成功数', 'int', 'NumberText', { sort: 110 }),
    field('ConflictCount', '冲突数', 'int', 'NumberText', { sort: 120 }),
    jsonField('PlanJson', '授权计划', 130),
    jsonField('ResultJson', '执行结果', 140),
    field('AppliedTime', '应用时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('RolledBackTime', '回滚时间', 'varchar(25)', 'DateTime', { sort: 160 })
  ], [
    { name: 'uk_mci_access_change_key', columns: ['ChangeKey'], unique: true, purpose: '授权变更稳定业务键' },
    { name: 'uk_mci_access_change_idempotency', columns: ['IdempotencyKey'], unique: true, purpose: '批量授权重复请求幂等' },
    { name: 'idx_mci_access_change_status_time', columns: ['Status', 'UpdateTime'], unique: false, purpose: '授权任务看板' }
  ]),
  table('mci_access_change_item', '批量授权逐用户证据', [
    field('ChangeSetId', '变更集Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('SequenceNo', '序号', 'int', 'NumberText', { notEmpty: 1, sort: 20 }),
    field('UserId', '用户Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Account', '账号', 'varchar(255)', 'Text', { sort: 40 }),
    field('BeforeRoleIds', '变更前角色', 'varchar(4000)', 'Textarea', { formWidth: 24, sort: 50 }),
    field('AfterRoleIds', '变更后角色', 'varchar(4000)', 'Textarea', { formWidth: 24, sort: 60 }),
    field('ExpectedBeforeHash', '前置哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 70 }),
    field('ExpectedAfterHash', '结果哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 80 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Pending', '待执行'], ['Applied', '已应用'], ['Conflict', '冲突'], ['Failed', '失败'], ['RolledBack', '已回滚']]), sort: 90 }),
    field('ErrorMessage', '错误说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 100 }),
    field('AppliedTime', '应用时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('RolledBackTime', '回滚时间', 'varchar(25)', 'DateTime', { sort: 120 })
  ], [
    { name: 'uk_mci_access_change_item_user', columns: ['ChangeSetId', 'UserId'], unique: true, purpose: '同一变更集内用户唯一' },
    { name: 'idx_mci_access_change_item_status', columns: ['ChangeSetId', 'Status', 'SequenceNo'], unique: false, purpose: '分片执行与冲突回查' }
  ]),
  table('mci_access_request', '访问申请、审批与复核', [
    field('RequestKey', '申请Key', 'varchar(160)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('RequesterUserId', '申请人Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('RequesterName', '申请人', 'varchar(200)', 'Text', { sort: 30 }),
    field('TargetType', '目标类型', 'varchar(50)', 'Select', { configSource: option([['Self', '本人'], ['Users', '用户'], ['Group', '用户组']]), sort: 40 }),
    jsonField('TargetUserIdsJson', '目标用户', 50),
    field('GroupId', '用户组Id', 'varchar(50)', 'Text', { sort: 60 }),
    field('ActionType', '申请动作', 'varchar(50)', 'Select', { configSource: option([['GrantRole', '授予角色']]), sort: 70 }),
    jsonField('RoleIdsJson', '申请角色', 80),
    field('Reason', '申请原因', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 90 }),
    field('RequestedStartTime', '期望开始时间', 'varchar(25)', 'DateTime', { sort: 100 }),
    field('ExpiresAt', '授权到期时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Pending', '待审批'], ['Approved', '已批准'], ['Rejected', '已拒绝'], ['Applied', '已应用'], ['PartiallyApplied', '部分应用'], ['Cancelled', '已取消'], ['Expired', '已到期'], ['Revoked', '已撤销'], ['Failed', '失败']]), sort: 120 }),
    field('PlanHash', '授权计划哈希', 'varchar(100)', 'Text', { sort: 130 }),
    field('ApprovalRef', '审批引用', 'varchar(200)', 'Text', { sort: 140 }),
    field('ApprovedBy', '审批人', 'varchar(200)', 'Text', { sort: 150 }),
    field('ApprovedTime', '审批时间', 'varchar(25)', 'DateTime', { sort: 160 }),
    field('DecisionReason', '审批意见', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 170 }),
    field('ChangeSetId', '授权变更集Id', 'varchar(50)', 'Text', { sort: 180 }),
    field('ReviewDueTime', '复核时间', 'varchar(25)', 'DateTime', { sort: 190 }),
    jsonField('ResultJson', '执行结果', 200)
  ], [
    { name: 'uk_mci_access_request_key', columns: ['RequestKey'], unique: true, purpose: '访问申请稳定幂等键' },
    { name: 'idx_mci_access_request_status_time', columns: ['Status', 'CreateTime'], unique: false, purpose: '访问审批队列' },
    { name: 'idx_mci_access_request_review', columns: ['Status', 'ReviewDueTime'], unique: false, purpose: '授权复核提醒' }
  ]),
  table('mci_access_entitlement', '临时授权权益与到期回收', [
    field('EntitlementKey', '权益Key', 'varchar(260)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('RequestId', '访问申请Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ChangeSetId', '授权变更集Id', 'varchar(50)', 'Text', { sort: 30 }),
    field('UserId', '用户Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 40 }),
    field('Account', '账号', 'varchar(255)', 'Text', { sort: 50 }),
    field('RoleId', '角色Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 60 }),
    field('GrantedTime', '授权时间', 'varchar(25)', 'DateTime', { sort: 70 }),
    field('ExpiresAt', '到期时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Active', '生效'], ['Expired', '已到期'], ['Revoked', '已撤销'], ['Superseded', '有其它有效授权'], ['Conflict', '回收冲突']]), sort: 90 }),
    field('EvidenceHash', '授权证据哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 100 }),
    field('RevokeTime', '回收时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('RevokeMessage', '回收结果', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 120 })
  ], [
    { name: 'uk_mci_access_entitlement_key', columns: ['EntitlementKey'], unique: true, purpose: '申请用户角色三元组幂等' },
    { name: 'idx_mci_access_entitlement_expiry', columns: ['Status', 'ExpiresAt'], unique: false, purpose: '到期授权回收扫描' },
    { name: 'idx_mci_access_entitlement_user_role', columns: ['UserId', 'RoleId', 'Status', 'ExpiresAt'], unique: false, purpose: '重叠授权引用检查' }
  ]),
  table('mci_org_snapshot', '组织结构不可变快照', [
    field('SnapshotKey', '快照Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('ContentHash', '内容哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 20 }),
    field('DeptCount', '部门数', 'int', 'NumberText', { sort: 30 }),
    field('UserCount', '用户数', 'int', 'NumberText', { sort: 40 }),
    field('Source', '快照来源', 'varchar(50)', 'Select', { configSource: option([['Manual', '手工'], ['Directory', '目录'], ['Scheduled', '定时']]), sort: 50 }),
    field('ChangeSummary', '变更摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 60 }),
    jsonField('SnapshotJson', '组织快照', 70),
    field('SnapshotTime', '快照时间', 'varchar(25)', 'DateTime', { sort: 80 })
  ], [
    { name: 'uk_mci_org_snapshot_key', columns: ['SnapshotKey'], unique: true, purpose: '组织快照稳定业务键' },
    { name: 'idx_mci_org_snapshot_time', columns: ['SnapshotTime'], unique: false, purpose: '组织结构时间线' }
  ]),
  table('mci_service_instance', '服务运行实例与租约', [
    field('ServiceId', '服务Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('InstanceKey', '实例Key', 'varchar(160)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Endpoint', '实例端点', 'varchar(2000)', 'Text', { notEmpty: 1, sort: 30 }),
    field('VersionNo', '版本号', 'varchar(100)', 'Text', { sort: 40 }),
    field('Zone', '可用区', 'varchar(100)', 'Text', { sort: 50 }),
    jsonField('LabelsJson', '实例标签', 60),
    field('State', '实例状态', 'varchar(50)', 'Select', { configSource: option([['Starting', '启动中'], ['Ready', '就绪'], ['Draining', '排空中'], ['Unavailable', '不可用'], ['Expired', '租约过期']]), sort: 70 }),
    field('Weight', '流量权重', 'int', 'NumberText', { sort: 80 }),
    field('TokenHash', '实例令牌哈希', 'varchar(100)', 'Text', { sort: 90, description: '只存认证令牌哈希；令牌原文只在首次注册时返回。' }),
    field('LeaseSeconds', '租约秒数', 'int', 'NumberText', { sort: 100 }),
    field('LeaseExpiresAt', '租约到期时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('LastHeartbeatTime', '最近心跳时间', 'varchar(25)', 'DateTime', { sort: 120 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { sort: 130 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 140 }),
    field('DrainingSince', '开始排空时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('StartedTime', '启动时间', 'varchar(25)', 'DateTime', { sort: 160 })
  ], [
    { name: 'uk_mci_service_instance_key', columns: ['ServiceId', 'InstanceKey'], unique: true, purpose: '同一服务实例Key唯一' },
    { name: 'idx_mci_service_instance_resolve', columns: ['ServiceId', 'State', 'LeaseExpiresAt', 'Weight'], unique: false, purpose: '在线实例解析' },
    { name: 'idx_mci_service_instance_lease', columns: ['LeaseExpiresAt', 'State'], unique: false, purpose: '租约过期扫描' }
  ]),
  table('mci_service_route_policy', '服务流量与韧性策略', [
    field('PolicyKey', '策略Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '策略名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ServiceId', '服务Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('VersionNo', '策略版本', 'varchar(50)', 'Text', { notEmpty: 1, sort: 40 }),
    jsonField('MatchJson', '匹配条件', 50),
    jsonField('TargetsJson', '版本权重与回退', 60),
    jsonField('RetryJson', '重试策略', 70),
    jsonField('CircuitJson', '熔断策略', 80),
    jsonField('RateLimitJson', '限流策略', 90),
    jsonField('DegradeJson', '降级策略', 100),
    field('TimeoutMs', '超时毫秒', 'int', 'NumberText', { sort: 110 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 120 }),
    field('ContentHash', '策略内容哈希', 'varchar(100)', 'Text', { sort: 130 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 140 }),
    field('LastValidatedTime', '最近校验时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 160 })
  ], [
    { name: 'uk_mci_service_route_policy_key', columns: ['PolicyKey'], unique: true, purpose: '服务策略稳定业务键' },
    { name: 'idx_mci_service_route_policy_service', columns: ['ServiceId', 'Enabled', 'UpdateTime'], unique: false, purpose: '服务运行策略查询' }
  ]),
  table('mci_service_call_outcome', '服务调用结果幂等台账', [
    field('OutcomeKey', '结果Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('PermitId', '调用许可Id', 'varchar(80)', 'Text', { notEmpty: 1, sort: 20 }),
    field('CallerUserId', '调用用户Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('ServiceId', '目标服务Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 40 }),
    field('InstanceId', '目标实例Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 50 }),
    field('PolicyKey', '策略Key', 'varchar(120)', 'Text', { sort: 60 }),
    field('PolicyHash', '策略内容哈希', 'varchar(100)', 'Text', { sort: 70 }),
    field('FromServiceKey', '来源服务Key', 'varchar(120)', 'Text', { sort: 80 }),
    field('Success', '调用成功', 'int', 'Switch', { sort: 90 }),
    field('StatusCode', '状态码', 'int', 'NumberText', { sort: 100 }),
    field('DurationMs', '耗时毫秒', 'decimal(18,4)', 'NumberText', { sort: 110 }),
    field('TraceId', 'TraceId', 'varchar(100)', 'Text', { sort: 120 }),
    field('Status', '处理状态', 'varchar(50)', 'Select', { configSource: option([['Applied', '已应用']]), sort: 130 }),
    field('AppliedTimestamp', '应用时间戳', 'bigint', 'NumberText', { sort: 140 }),
    field('AppliedTime', '应用时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    jsonField('ResultJson', '处理结果', 160)
  ], [
    { name: 'uk_mci_service_call_outcome_key', columns: ['OutcomeKey'], unique: true, purpose: '每个调用许可只结算一次' },
    { name: 'uk_mci_service_call_outcome_permit', columns: ['PermitId'], unique: true, purpose: '调用结果重试幂等' },
    { name: 'idx_mci_service_call_outcome_circuit', columns: ['PolicyHash', 'InstanceId', 'Status', 'AppliedTimestamp'], unique: false, purpose: '从持久结果重建熔断状态' },
    { name: 'idx_mci_service_call_outcome_service', columns: ['ServiceId', 'AppliedTimestamp'], unique: false, purpose: '服务调用审计时间线' }
  ]),
  table('mci_service_call_edge', '服务调用拓扑聚合边', [
    field('EdgeKey', '拓扑边Key', 'varchar(240)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('FromServiceId', '来源服务Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ToServiceId', '目标服务Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Environment', '环境', 'varchar(50)', 'Text', { sort: 40 }),
    field('CallCount', '调用次数', 'bigint', 'NumberText', { sort: 50 }),
    field('ErrorCount', '错误次数', 'bigint', 'NumberText', { sort: 60 }),
    field('P95DurationMs', 'P95耗时毫秒', 'decimal(18,4)', 'NumberText', { sort: 70 }),
    field('LastTraceId', '最近TraceId', 'varchar(100)', 'Text', { sort: 80 }),
    field('LastSeenTime', '最近发现时间', 'varchar(25)', 'DateTime', { sort: 90 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 100 })
  ], [
    { name: 'uk_mci_service_call_edge_key', columns: ['EdgeKey'], unique: true, purpose: '服务拓扑边幂等聚合键' },
    { name: 'idx_mci_service_call_edge_from', columns: ['FromServiceId', 'LastSeenTime'], unique: false, purpose: '上游拓扑查询' },
    { name: 'idx_mci_service_call_edge_to', columns: ['ToServiceId', 'LastSeenTime'], unique: false, purpose: '下游影响查询' }
  ]),
  table('mci_log_policy', '日志采集、脱敏、留存与配额策略', [
    field('PolicyKey', '策略Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '策略名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('SourceType', '日志来源', 'varchar(50)', 'Select', { configSource: option([['All', '全部'], ['Application', '应用'], ['System', '系统'], ['Container', '容器'], ['Audit', '审计']]), sort: 30 }),
    jsonField('MatchJson', '匹配与采样规则', 40),
    jsonField('RedactionJson', '脱敏规则链', 50),
    field('HotDays', '热存储天数', 'int', 'NumberText', { sort: 60 }),
    field('WarmDays', '温存储天数', 'int', 'NumberText', { sort: 70 }),
    field('ColdDays', '冷存储天数', 'int', 'NumberText', { sort: 80 }),
    field('DailyQuotaMB', '每日配额MB', 'int', 'NumberText', { sort: 90 }),
    field('TotalQuotaMB', '总配额MB', 'int', 'NumberText', { sort: 100 }),
    field('OverQuotaAction', '超限动作', 'varchar(50)', 'Select', { configSource: option([['Alert', '仅告警'], ['Sample', '降低采样'], ['RejectDebug', '拒绝调试日志']]), sort: 110 }),
    field('ArchiveMode', '归档模式', 'varchar(50)', 'Select', { configSource: option([['PrivateHdfs', '私有文件存储'], ['Extension', '租户归档扩展'], ['DeleteOnly', '仅删除']]), sort: 120 }),
    field('LegalHold', '法律保留', 'int', 'Switch', { sort: 130 }),
    field('LastRunTime', '最近执行时间', 'varchar(25)', 'DateTime', { sort: 140 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 150 })
  ], [
    { name: 'uk_mci_log_policy_key', columns: ['PolicyKey'], unique: true, purpose: '日志治理策略稳定业务键' },
    { name: 'idx_mci_log_policy_enabled', columns: ['Enabled', 'LastRunTime'], unique: false, purpose: '生命周期任务扫描' }
  ]),
  table('mci_log_lifecycle_run', '日志生命周期执行记录', [
    field('RunKey', '运行Key', 'varchar(160)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('PolicyId', '策略Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Planned', '已计划'], ['Running', '执行中'], ['Completed', '已完成'], ['CompletedWithErrors', '完成但有错误'], ['BlockedLegalHold', '法律保留阻断'], ['Failed', '失败']]), sort: 40 }),
    field('CutoffTime', '清理截止时间', 'varchar(25)', 'DateTime', { sort: 50 }),
    field('ScannedCount', '扫描条数', 'bigint', 'NumberText', { sort: 60 }),
    field('ArchivedCount', '归档条数', 'bigint', 'NumberText', { sort: 70 }),
    field('DeletedCount', '删除条数', 'bigint', 'NumberText', { sort: 80 }),
    field('ArchiveProofHash', '归档证明哈希', 'varchar(100)', 'Text', { sort: 90 }),
    field('ArchivePath', '私有归档路径', 'varchar(2000)', 'Text', { sort: 100 }),
    field('BackgroundTaskId', '后台任务Id', 'varchar(100)', 'Text', { sort: 110 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { sort: 120 }),
    jsonField('CheckpointJson', '执行检查点', 130),
    field('StartedTime', '开始时间', 'varchar(25)', 'DateTime', { sort: 140 }),
    field('FinishedTime', '结束时间', 'varchar(25)', 'DateTime', { sort: 150 }),
    field('LastError', '最近错误', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 160 })
  ], [
    { name: 'uk_mci_log_lifecycle_run_key', columns: ['RunKey'], unique: true, purpose: '策略与执行窗口幂等' },
    { name: 'idx_mci_log_lifecycle_status', columns: ['Status', 'UpdateTime'], unique: false, purpose: '可恢复日志任务扫描' }
  ]),
  table('mci_alert_route', '告警路由、值班与升级策略', [
    field('RouteKey', '路由Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '路由名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Priority', '优先级', 'int', 'NumberText', { sort: 30 }),
    jsonField('MatchJson', '路由匹配条件', 40),
    jsonField('ChannelsJson', '通知渠道', 50),
    jsonField('ScheduleJson', '值班排班', 60),
    jsonField('EscalationJson', '升级链', 70),
    field('AcknowledgeSlaMinutes', '确认SLA分钟', 'int', 'NumberText', { sort: 80 }),
    field('ResolveSlaMinutes', '解决SLA分钟', 'int', 'NumberText', { sort: 90 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 100 }),
    field('Enabled', '启用', 'int', 'Switch', { sort: 110 })
  ], [
    { name: 'uk_mci_alert_route_key', columns: ['RouteKey'], unique: true, purpose: '告警路由稳定业务键' },
    { name: 'idx_mci_alert_route_priority', columns: ['Enabled', 'Priority'], unique: false, purpose: '告警路由匹配顺序' }
  ]),
  table('mci_alert_delivery', '告警通知送达与升级证据', [
    field('DeliveryKey', '送达Key', 'varchar(220)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('AlertId', '告警Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('RouteId', '路由Id', 'varchar(50)', 'Text', { sort: 30 }),
    field('EventKind', '事件类型', 'varchar(50)', 'Select', { configSource: option([['Trigger', '触发'], ['Reopen', '重开'], ['Recovery', '恢复'], ['Escalation', '升级']]), sort: 40 }),
    field('EscalationLevel', '升级级别', 'int', 'NumberText', { sort: 50 }),
    field('Channel', '通知渠道', 'varchar(100)', 'Text', { sort: 60 }),
    field('Recipient', '接收目标', 'varchar(500)', 'Text', { sort: 70 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Pending', '待发送'], ['Sending', '发送中'], ['Delivered', '已送达'], ['Acknowledged', '已确认'], ['Failed', '失败'], ['Suppressed', '已抑制']]), sort: 80 }),
    field('AttemptCount', '尝试次数', 'int', 'NumberText', { sort: 90 }),
    field('RemoteMessageId', '远端消息Id', 'varchar(500)', 'Text', { sort: 100 }),
    field('DeliveredTime', '送达时间', 'varchar(25)', 'DateTime', { sort: 110 }),
    field('NextRetryTime', '下次重试时间', 'varchar(25)', 'DateTime', { sort: 120 }),
    field('ClaimToken', '抢占令牌', 'varchar(50)', 'Text', { sort: 130 }),
    field('LeaseExpiresAt', '租约到期时间', 'varchar(25)', 'DateTime', { sort: 140 }),
    field('RowVersion', '行版本', 'bigint', 'NumberText', { sort: 150 }),
    field('LastError', '最近错误', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 160 })
  ], [
    { name: 'uk_mci_alert_delivery_key', columns: ['DeliveryKey'], unique: true, purpose: '告警事件类型、级别、渠道和接收人幂等' },
    { name: 'idx_mci_alert_delivery_retry', columns: ['Status', 'NextRetryTime', 'LeaseExpiresAt'], unique: false, purpose: '失败重试、租约恢复与升级扫描' }
  ]),
  table('mci_asset_package', '可复用区块、组件与模板包', [
    field('PackageKey', '资产包Key', 'varchar(140)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '资产包名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('AssetType', '资产类型', 'varchar(50)', 'Select', { configSource: option([['Block', '区块'], ['Component', '组件'], ['PageTemplate', '页面模板'], ['Theme', '主题'], ['DataAdapter', '数据适配器']]), sort: 30 }),
    field('Scope', '作用域', 'varchar(50)', 'Select', { configSource: option([['Tenant', '当前租户'], ['Application', '应用'], ['Official', '官方']]), sort: 40 }),
    field('CurrentVersionId', '当前版本Id', 'varchar(50)', 'Text', { sort: 50 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Draft', '草稿'], ['Published', '已发布'], ['Deprecated', '已废弃'], ['Archived', '已归档']]), sort: 60 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 70 }),
    jsonField('TagsJson', '标签', 80),
    field('Description', '说明', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 90 })
  ], [
    { name: 'uk_mci_asset_package_key', columns: ['PackageKey'], unique: true, purpose: '资产包稳定业务键' },
    { name: 'idx_mci_asset_package_type_status', columns: ['AssetType', 'Status', 'UpdateTime'], unique: false, purpose: '物料目录检索' }
  ]),
  table('mci_asset_version', '资产包不可变版本与兼容矩阵', [
    field('PackageId', '资产包Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('VersionNo', '版本号', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ContentHash', '内容哈希', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('SignatureHash', '签名摘要', 'varchar(100)', 'Text', { sort: 40 }),
    field('MinPlatformVersion', '最低平台版本', 'varchar(50)', 'Text', { sort: 50 }),
    field('MaxPlatformVersion', '最高平台版本', 'varchar(50)', 'Text', { sort: 60 }),
    jsonField('DependenciesJson', '依赖清单', 70),
    jsonField('ManifestJson', '资产Manifest', 80),
    jsonField('ContentJson', '资产内容', 90),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Published', '已发布'], ['Superseded', '已替代'], ['Revoked', '已撤销']]), sort: 100 }),
    field('PublishedTime', '发布时间', 'varchar(25)', 'DateTime', { sort: 110 })
  ], [
    { name: 'uk_mci_asset_version_no', columns: ['PackageId', 'VersionNo'], unique: true, purpose: '资产包语义版本唯一' },
    { name: 'uk_mci_asset_version_hash', columns: ['PackageId', 'ContentHash'], unique: true, purpose: '资产内容幂等发布' }
  ]),
  table('mci_change_set', '跨资源变更台账与交付证据', [
    field('ChangeKey', '变更Key', 'varchar(140)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '变更名称', 'varchar(300)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Environment', '环境', 'varchar(50)', 'Select', { configSource: option([['Development', '开发'], ['Test', '测试'], ['Staging', '预发布'], ['Production', '生产']]), sort: 30 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Draft', '草稿'], ['Reviewing', '评审中'], ['Approved', '已批准'], ['Applying', '应用中'], ['Applied', '已应用'], ['Verified', '已验证'], ['RolledBack', '已回滚'], ['Failed', '失败']]), sort: 40 }),
    field('PlanHash', '计划哈希', 'varchar(100)', 'Text', { sort: 50 }),
    field('Owner', '负责人', 'varchar(200)', 'Text', { sort: 60 }),
    field('RequirementRef', '需求引用', 'varchar(500)', 'Text', { sort: 70 }),
    field('ApprovalRef', '审批引用', 'varchar(500)', 'Text', { sort: 80 }),
    jsonField('ResourcesJson', '资源与版本清单', 90),
    jsonField('EvidenceJson', '测试与回读证据', 100),
    jsonField('RollbackJson', '回滚计划', 110),
    field('AppliedTime', '应用时间', 'varchar(25)', 'DateTime', { sort: 120 }),
    field('VerifiedTime', '验证时间', 'varchar(25)', 'DateTime', { sort: 130 })
  ], [
    { name: 'uk_mci_change_set_key', columns: ['ChangeKey'], unique: true, purpose: '跨资源变更稳定业务键' },
    { name: 'idx_mci_change_set_status_env', columns: ['Environment', 'Status', 'UpdateTime'], unique: false, purpose: '变更发布看板' }
  ]),
  table('mci_collaboration_session', '资源协作租约与评论摘要', [
    field('ResourceType', '资源类型', 'varchar(50)', 'Text', { notEmpty: 1, sort: 10 }),
    field('ResourceId', '资源Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('ClientLeaseId', '客户端租约Id', 'varchar(120)', 'Text', { notEmpty: 1, sort: 30 }),
    field('HolderUserId', '持有人Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 40 }),
    field('HolderName', '持有人', 'varchar(200)', 'Text', { sort: 50 }),
    field('State', '状态', 'varchar(50)', 'Select', { configSource: option([['Active', '编辑中'], ['Released', '已释放'], ['Expired', '已过期']]), sort: 60 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { sort: 70 }),
    field('LeaseExpiresAt', '租约到期时间', 'varchar(25)', 'DateTime', { sort: 80 }),
    field('LastHeartbeatTime', '最近心跳时间', 'varchar(25)', 'DateTime', { sort: 90 }),
    field('CommentCount', '评论数', 'int', 'NumberText', { sort: 100 }),
    field('Summary', '协作摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 110 })
  ], [
    { name: 'uk_mci_collaboration_resource', columns: ['ResourceType', 'ResourceId'], unique: true, purpose: '每个资源只有一个活动协作租约事实源' },
    { name: 'idx_mci_collaboration_expiry', columns: ['State', 'LeaseExpiresAt'], unique: false, purpose: '租约过期扫描' }
  ])
]

const engineSpecs = [
  ['mci-ai-platform-overview', 'AI平台治理总览', 'mci_ai_platform_overview.js', 'Managed'],
  ['mci-portal-publish-plan', '门户发布计划', 'mci_portal_plan.js', 'Managed'],
  ['mci-portal-publish', '门户原子发布', 'mci_portal_publish.js', 'Managed'],
  ['mci-portal-resolve', '门户发布态解析', 'mci_portal_resolve.js', 'Managed'],
  ['mci-resource-compare', '资源版本比较', 'mci_resource_compare.js', 'Managed'],
  ['mci-resource-rollback', '资源版本回滚', 'mci_resource_rollback.js', 'Managed'],
  ['mci-identity-sync-plan', '身份同步计划', 'mci_identity_sync_plan.js', 'Managed'],
  ['mci-identity-sync-apply', '身份同步执行', 'mci_identity_sync_apply.js', 'Managed'],
  ['mci-permission-explain', '权限决策解释', 'mci_permission_explain.js', 'Managed'],
  ['mci-configuration-publish', '配置模板校验与发布', 'mci_configuration_publish.js', 'Managed'],
  ['mci-configuration-resolve', '配置继承安全解析', 'mci_configuration_resolve.js', 'Managed'],
  ['mci-configuration-drift-scan', '配置基线漂移巡检', 'mci_configuration_drift_scan.js', 'Managed'],
  ['mci-configuration-drift-transition', '配置漂移处置状态机', 'mci_configuration_drift_transition.js', 'Managed'],
  ['mci-feature-flag-publish', '功能开关校验与发布', 'mci_feature_flag_publish.js', 'Managed'],
  ['mci-feature-flag-evaluate', '功能开关评估', 'mci_feature_flag_evaluate.js', 'Managed'],
  ['mci-release-plan-publish', '发布计划校验与固定', 'mci_release_plan_publish.js', 'Managed'],
  ['mci-release-transition', '发布审批状态机', 'mci_release_transition.js', 'Managed'],
  ['mci-release-validate', '发布门禁验证', 'mci_release_validate.js', 'Managed'],
  ['mci-release-execute', '发布与回滚断点执行', 'mci_release_execute.js', 'Managed'],
  ['mci-observability-overview', '可观测治理总览', 'mci_observability_overview.js', 'Managed'],
  ['mci-alert-evaluate', '告警策略评估', 'mci_alert_evaluate.js', 'Managed', { stopHttp: 1 }],
  ['mci-alert-evaluate-manual', '告警策略手工评估', 'mci_alert_evaluate_manual.js', 'Managed'],
  ['mci-alert-scan', '定时告警策略扫描', 'mci_alert_scan.js', 'Managed', { stopHttp: 1 }],
  ['mci-import-plan', '可恢复导入预检', 'mci_import_plan.js', 'Managed'],
  ['mci-import-stage', '可恢复导入暂存', 'mci_import_stage.js', 'Managed'],
  ['mci-import-execute', '可恢复导入分片执行', 'mci_import_execute.js', 'Managed'],
  ['mci-import-control', '可恢复导入状态控制', 'mci_import_control.js', 'Managed'],
  ['mci-import-rollback', '可恢复导入分片回滚', 'mci_import_rollback.js', 'Managed'],
  ['mci-identity-group-preview', '动态用户组预览', 'mci_identity_group_preview.js', 'Managed'],
  ['mci-identity-group-refresh', '动态用户组成员快照刷新', 'mci_identity_group_refresh.js', 'Managed'],
  ['mci-identity-tag-assign', '用户标签分配与撤销', 'mci_identity_tag_assign.js', 'Managed'],
  ['mci-access-change-plan', '批量授权计划', 'mci_access_change_plan.js', 'Managed'],
  ['mci-access-change-apply', '批量授权执行', 'mci_access_change_apply.js', 'Managed'],
  ['mci-access-change-rollback', '批量授权条件回滚', 'mci_access_change_rollback.js', 'Managed'],
  ['mci-access-request', '访问申请审批与授权', 'mci_access_request.js', 'Managed'],
  ['mci-access-entitlement-expire', '临时授权到期回收', 'mci_access_entitlement_expire.js', 'Managed', { stopHttp: 1 }],
  ['mci-org-snapshot', '组织结构不可变快照', 'mci_org_snapshot.js', 'Managed'],
  ['mci-service-instance-register', '服务实例注册', 'mci_service_instance_register.js', 'Managed'],
  ['mci-service-instance-heartbeat', '服务实例心跳续租', 'mci_service_instance_heartbeat.js', 'Managed'],
  ['mci-service-instance-drain', '服务实例排空', 'mci_service_instance_drain.js', 'Managed'],
  ['mci-service-policy-publish', '服务流量与韧性策略发布', 'mci_service_policy_publish.js', 'Managed'],
  ['mci-service-resolve', '服务实例稳定解析', 'mci_service_resolve.js', 'Managed'],
  ['mci-service-policy-acquire', '服务调用限流与熔断许可', 'mci_service_policy_acquire.js', 'Managed'],
  ['mci-service-policy-outcome', '服务调用结果与熔断反馈', 'mci_service_policy_outcome.js', 'Managed'],
  ['mci-service-edge-record', '服务调用拓扑聚合', 'mci_service_edge_record.js', 'Managed'],
  ['mci-service-topology', '服务运行拓扑', 'mci_service_topology.js', 'Managed'],
  ['mci-trace-timeline', 'W3C Trace时间线', 'mci_trace_timeline.js', 'Managed'],
  ['mci-log-lifecycle-plan', '日志生命周期计划', 'mci_log_lifecycle_plan.js', 'Managed'],
  ['mci-log-lifecycle-execute', '日志生命周期分片执行', 'mci_log_lifecycle_execute.js', 'Managed'],
  ['mci-alert-dispatch', '告警路由与升级派发', 'mci_alert_dispatch.js', 'Managed', { stopHttp: 1 }],
  ['mci-alert-delivery-send', '告警通知租约式送达', 'mci_alert_delivery_send.js', 'Managed', { stopHttp: 1 }],
  ['mci-alert-transition', '告警处置状态机', 'mci_alert_transition.js', 'Managed'],
  ['mci-asset-publish', '可复用资产包发布', 'mci_asset_publish.js', 'Managed'],
  ['mci-asset-resolve', '可复用资产包解析', 'mci_asset_resolve.js', 'Managed'],
  ['mci-collaboration-lease', '资源协作租约', 'mci_collaboration_lease.js', 'Managed'],
  ['mci-change-set-validate', '跨资源变更门禁', 'mci_change_set_validate.js', 'Managed'],
  ['mci-platform-maintenance', '平台治理周期维护', 'mci_platform_maintenance.js', 'Managed', { stopHttp: 1 }],
  ['mci-portal-publish-extension', '门户发布租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-identity-source-extension', '身份来源租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-release-gate-extension', '发布门禁租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-alert-notify-extension', '告警通知租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-asset-validate-extension', '资产包校验租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-log-archive-extension', '日志归档租户扩展', 'mci_extension_hook.js', 'CreateIfMissing'],
  ['mci-release-execute-extension', '发布执行租户扩展', 'mci_extension_hook.js', 'CreateIfMissing']
]

const engines = await Promise.all(engineSpecs.map(async ([apiEngineKey, apiName, file, policy, options = {}]) => ({
  apiEngineKey,
  apiName,
  category: 'Microi AI平台治理',
  v8Unlimited: false,
  stopHttp: options.stopHttp === 1 || policy === 'CreateIfMissing' ? 1 : 0,
  allowAnonymous: options.allowAnonymous === 1 || apiEngineKey === 'mci-portal-resolve' ? 1 : 0,
  code: await readFile(resolve(root, 'engines', file), 'utf8')
})))

const SYSTEM_ENGINE_MENU_ID = 'cdc0844b-7249-4d64-a9c3-563a15c9cd20'
const GOVERNANCE_ROOT_NAME = 'AI平台治理'
const GOVERNANCE_WORKBENCH_NAME = 'AI平台治理工作台'

const module = (name, tableName, listFields, searchFields, mobileFields) => ({
  name,
  table: tableName,
  icon: 'fas fa-shield-alt',
  display: 1,
  appDisplay: 1,
  listFields,
  searchFields,
  sortFields: ['CreateTime', 'UpdateTime'],
  mobileFields,
  cardTitleFields: listFields.filter((item) => /Status|State|Severity|Type|Enabled/.test(item)).slice(0, 2),
  cardBottomFields: listFields.filter((item) => /Time|Count|Version/.test(item)).slice(0, 2),
  defaultOrderBy: [{ field: 'UpdateTime', type: 'DESC' }],
  enableViewSchema: 1,
  viewSchemaVersion: '1.0',
  viewConfigVersion: 1
})

const dataModules = [
  module('AI平台治理·门户项目', 'mci_portal_project', ['ProjectKey', 'Name', 'Status', 'PublishedTime'], ['ProjectKey', 'Name', 'Status'], ['Name', 'Status', 'PublishedTime']),
  module('AI平台治理·门户插槽', 'mci_portal_slot', ['ProjectId', 'SlotKey', 'Name', 'LayoutType', 'Enabled'], ['ProjectId', 'SlotKey', 'Name'], ['Name', 'LayoutType', 'Enabled']),
  module('AI平台治理·门户资源', 'mci_portal_asset', ['ProjectId', 'AssetKey', 'Name', 'AssetType', 'Enabled'], ['ProjectId', 'AssetKey', 'Name', 'AssetType'], ['Name', 'AssetType', 'Enabled']),
  module('AI平台治理·资源版本', 'mci_resource_version', ['ResourceType', 'ResourceKey', 'VersionNo', 'Status', 'PublishedTime'], ['ResourceType', 'ResourceKey', 'VersionNo'], ['ResourceKey', 'VersionNo', 'Status']),
  module('AI平台治理·身份连接器', 'mci_identity_connector', ['ConnectorKey', 'Name', 'ConnectorType', 'Enabled', 'LastSyncTime'], ['ConnectorKey', 'Name', 'ConnectorType'], ['Name', 'ConnectorType', 'Enabled']),
  module('AI平台治理·身份同步', 'mci_identity_sync_run', ['ConnectorId', 'Status', 'AddCount', 'UpdateCount', 'ConflictCount', 'StartedTime'], ['ConnectorId', 'Status', 'IdempotencyKey'], ['Status', 'AddCount', 'ConflictCount']),
  module('AI平台治理·身份冲突', 'mci_identity_sync_conflict', ['Account', 'ConflictType', 'Status', 'Message', 'ResolutionTime'], ['Account', 'ConflictType', 'Status'], ['Account', 'ConflictType', 'Status']),
  module('AI平台治理·配置模板', 'mci_configuration_profile', ['ProfileKey', 'Name', 'Category', 'Environment', 'VersionNo', 'Status', 'Enabled'], ['ProfileKey', 'Name', 'Category', 'Environment', 'Status'], ['Name', 'Environment', 'Status']),
  module('AI平台治理·配置漂移', 'mci_configuration_drift', ['BaselineProfileId', 'TargetProfileId', 'Environment', 'Status', 'DetectedTime', 'ResolvedTime'], ['BaselineProfileId', 'TargetProfileId', 'Environment', 'Status'], ['Environment', 'Status', 'DetectedTime']),
  module('AI平台治理·功能开关', 'mci_feature_flag', ['FlagKey', 'Name', 'Enabled', 'Percentage', 'Variant', 'Owner'], ['FlagKey', 'Name', 'Enabled', 'Owner'], ['Name', 'Enabled', 'Percentage']),
  module('AI平台治理·发布计划', 'mci_release_plan', ['ReleaseKey', 'Name', 'VersionNo', 'Environment', 'Status', 'LastCheckTime'], ['ReleaseKey', 'Name', 'VersionNo', 'Environment', 'Status'], ['Name', 'VersionNo', 'Status']),
  module('AI平台治理·发布审批', 'mci_release_approval', ['ReleasePlanId', 'ReviewRound', 'ApproverName', 'Decision', 'DecisionTime'], ['ReleasePlanId', 'ApproverName', 'Decision'], ['ApproverName', 'Decision', 'DecisionTime']),
  module('AI平台治理·发布运行', 'mci_release_run', ['ReleasePlanId', 'Direction', 'Status', 'Checkpoint', 'TotalSteps', 'StartedTime', 'FinishedTime'], ['ReleasePlanId', 'Direction', 'Status', 'IdempotencyKey'], ['Direction', 'Status', 'Checkpoint']),
  module('AI平台治理·服务目录', 'mci_service_registry', ['ServiceKey', 'Name', 'ServiceType', 'Environment', 'HealthState', 'Owner'], ['ServiceKey', 'Name', 'ServiceType', 'Environment', 'HealthState'], ['Name', 'HealthState', 'Environment']),
  module('AI平台治理·可观测策略', 'mci_observability_policy', ['PolicyKey', 'Name', 'MetricName', 'Operator', 'Threshold', 'Severity', 'Enabled'], ['PolicyKey', 'Name', 'MetricName', 'Severity'], ['Name', 'Severity', 'Enabled']),
  module('AI平台治理·告警事件', 'mci_alert_event', ['Title', 'Severity', 'Status', 'ObservedValue', 'Threshold', 'FirstSeenTime'], ['Title', 'Severity', 'Status', 'EventId'], ['Title', 'Severity', 'Status']),
  module('AI平台治理·规则评估台账', 'mci_observability_evaluation', ['PolicyId', 'WindowKey', 'SignalType', 'ObservedValue', 'Triggered', 'Status', 'EvaluatedTime'], ['PolicyId', 'WindowKey', 'SignalType', 'Status'], ['SignalType', 'Triggered', 'Status']),
  module('AI平台治理·导入批次', 'mci_import_job', ['ImportKey', 'TargetTable', 'Status', 'TotalCount', 'SuccessCount', 'FailedCount', 'Progress'], ['ImportKey', 'TargetTable', 'Status', 'FileHash'], ['TargetTable', 'Status', 'Progress']),
  module('AI平台治理·导入暂存行', 'mci_import_row', ['JobId', 'RowNo', 'Action', 'Status', 'TargetId', 'ErrorMessage'], ['JobId', 'Status', 'Action', 'TargetId'], ['RowNo', 'Action', 'Status']),
  module('AI平台治理·动态用户组', 'mci_identity_group', ['GroupKey', 'Name', 'GroupType', 'MemberCount', 'LastEvaluatedTime', 'Enabled'], ['GroupKey', 'Name', 'GroupType', 'Enabled'], ['Name', 'GroupType', 'MemberCount']),
  module('AI平台治理·用户组成员', 'mci_identity_group_member', ['GroupId', 'SnapshotId', 'Account', 'MembershipSource', 'Status', 'EffectiveFrom'], ['GroupId', 'SnapshotId', 'Account', 'Status'], ['Account', 'MembershipSource', 'Status']),
  module('AI平台治理·用户标签', 'mci_identity_tag', ['TagKey', 'Name', 'Category', 'ValueType', 'Scope', 'Enabled'], ['TagKey', 'Name', 'Category', 'Scope', 'Enabled'], ['Name', 'Category', 'Enabled']),
  module('AI平台治理·标签分配', 'mci_identity_tag_assignment', ['TagId', 'Account', 'SourceType', 'Status', 'EffectiveFrom', 'ExpiresAt'], ['TagId', 'Account', 'SourceType', 'Status'], ['Account', 'Status', 'ExpiresAt']),
  module('AI平台治理·授权变更集', 'mci_access_change_set', ['ChangeKey', 'ActionType', 'TargetType', 'Status', 'TotalCount', 'SuccessCount', 'ConflictCount'], ['ChangeKey', 'ActionType', 'Status', 'IdempotencyKey'], ['ActionType', 'Status', 'SuccessCount']),
  module('AI平台治理·授权变更明细', 'mci_access_change_item', ['ChangeSetId', 'SequenceNo', 'Account', 'Status', 'ErrorMessage', 'AppliedTime'], ['ChangeSetId', 'Account', 'Status'], ['Account', 'Status', 'AppliedTime']),
  module('AI平台治理·访问申请', 'mci_access_request', ['RequestKey', 'RequesterName', 'TargetType', 'Status', 'ExpiresAt', 'ApprovedBy', 'ReviewDueTime'], ['RequestKey', 'RequesterName', 'Status', 'ApprovedBy'], ['RequesterName', 'Status', 'ExpiresAt']),
  module('AI平台治理·临时授权', 'mci_access_entitlement', ['Account', 'RoleId', 'Status', 'GrantedTime', 'ExpiresAt', 'RevokeTime'], ['Account', 'RoleId', 'Status'], ['Account', 'Status', 'ExpiresAt']),
  module('AI平台治理·组织快照', 'mci_org_snapshot', ['SnapshotKey', 'ContentHash', 'DeptCount', 'UserCount', 'Source', 'SnapshotTime'], ['SnapshotKey', 'ContentHash', 'Source'], ['SnapshotKey', 'DeptCount', 'UserCount']),
  module('AI平台治理·服务实例', 'mci_service_instance', ['ServiceId', 'InstanceKey', 'VersionNo', 'Zone', 'State', 'LeaseExpiresAt', 'FencingToken'], ['ServiceId', 'InstanceKey', 'VersionNo', 'State'], ['InstanceKey', 'State', 'LeaseExpiresAt']),
  module('AI平台治理·流量策略', 'mci_service_route_policy', ['PolicyKey', 'Name', 'ServiceId', 'VersionNo', 'TimeoutMs', 'Enabled'], ['PolicyKey', 'Name', 'ServiceId', 'Enabled'], ['Name', 'VersionNo', 'Enabled']),
  module('AI平台治理·调用结果', 'mci_service_call_outcome', ['ServiceId', 'InstanceId', 'PolicyKey', 'Success', 'StatusCode', 'DurationMs', 'Status', 'AppliedTime'], ['ServiceId', 'InstanceId', 'PolicyKey', 'Success', 'StatusCode'], ['PolicyKey', 'Success', 'Status']),
  module('AI平台治理·服务拓扑', 'mci_service_call_edge', ['FromServiceId', 'ToServiceId', 'Environment', 'CallCount', 'ErrorCount', 'P95DurationMs', 'LastSeenTime'], ['FromServiceId', 'ToServiceId', 'Environment'], ['Environment', 'CallCount', 'ErrorCount']),
  module('AI平台治理·日志策略', 'mci_log_policy', ['PolicyKey', 'Name', 'SourceType', 'HotDays', 'WarmDays', 'ColdDays', 'ArchiveMode', 'Enabled'], ['PolicyKey', 'Name', 'SourceType', 'ArchiveMode', 'Enabled'], ['Name', 'SourceType', 'ColdDays']),
  module('AI平台治理·日志生命周期', 'mci_log_lifecycle_run', ['RunKey', 'PolicyId', 'Status', 'ScannedCount', 'ArchivedCount', 'DeletedCount', 'FinishedTime'], ['RunKey', 'PolicyId', 'Status'], ['Status', 'ArchivedCount', 'DeletedCount']),
  module('AI平台治理·告警路由', 'mci_alert_route', ['RouteKey', 'Name', 'Priority', 'AcknowledgeSlaMinutes', 'ResolveSlaMinutes', 'Owner', 'Enabled'], ['RouteKey', 'Name', 'Owner', 'Enabled'], ['Name', 'Priority', 'Enabled']),
  module('AI平台治理·告警送达', 'mci_alert_delivery', ['AlertId', 'EventKind', 'EscalationLevel', 'Channel', 'Recipient', 'Status', 'AttemptCount', 'DeliveredTime'], ['AlertId', 'EventKind', 'Channel', 'Recipient', 'Status'], ['EventKind', 'Channel', 'Status']),
  module('AI平台治理·资产包', 'mci_asset_package', ['PackageKey', 'Name', 'AssetType', 'Scope', 'Status', 'Owner'], ['PackageKey', 'Name', 'AssetType', 'Scope', 'Status'], ['Name', 'AssetType', 'Status']),
  module('AI平台治理·资产版本', 'mci_asset_version', ['PackageId', 'VersionNo', 'ContentHash', 'MinPlatformVersion', 'MaxPlatformVersion', 'Status', 'PublishedTime'], ['PackageId', 'VersionNo', 'ContentHash', 'Status'], ['VersionNo', 'Status', 'PublishedTime']),
  module('AI平台治理·变更台账', 'mci_change_set', ['ChangeKey', 'Name', 'Environment', 'Status', 'Owner', 'AppliedTime', 'VerifiedTime'], ['ChangeKey', 'Name', 'Environment', 'Status', 'Owner'], ['Name', 'Environment', 'Status']),
  module('AI平台治理·协作租约', 'mci_collaboration_session', ['ResourceType', 'ResourceId', 'HolderName', 'State', 'FencingToken', 'LeaseExpiresAt'], ['ResourceType', 'ResourceId', 'HolderName', 'State'], ['HolderName', 'State', 'LeaseExpiresAt'])
]

const governanceAreas = [
  {
    key: 'portal',
    name: '门户装配',
    purpose: '管理可组合门户及其不可变发布版本。',
    menus: [
      { name: '门户项目', kind: '配置', purpose: '定义一个门户及其当前发布状态。' },
      { name: '门户插槽', kind: '配置', purpose: '定义门户页面中可装配内容的位置。' },
      { name: '门户资源', kind: '配置', purpose: '维护装入插槽的页面、组件和资源。' },
      { name: '资源版本', kind: '台账', purpose: '保存资源不可变版本，用于比较、审计和回滚。' }
    ]
  },
  {
    key: 'identity',
    name: '身份目录',
    purpose: '把外部组织与账号同步到吾码身份体系并保留冲突证据。',
    menus: [
      { name: '身份连接器', kind: '配置', purpose: '配置企业微信、钉钉、LDAP 等身份来源。' },
      { name: '身份同步', kind: '运行', purpose: '查看每次组织和账号同步的执行结果。' },
      { name: '身份冲突', kind: '处置', purpose: '处理重名、账号碰撞和归属不一致。' },
      { name: '组织快照', kind: '台账', purpose: '保存部门树与用户归属的不可变快照。' }
    ]
  },
  {
    key: 'access',
    name: '人群与授权',
    purpose: '用动态人群、标签和审批式变更治理访问权限。',
    menus: [
      { name: '动态用户组', kind: '配置', purpose: '按规则生成可重复计算的用户人群。' },
      { name: '用户组成员', kind: '台账', purpose: '查看某次计算得到的实际成员。' },
      { name: '用户标签', kind: '配置', purpose: '定义用户分类、范围和标签类型。' },
      { name: '标签分配', kind: '台账', purpose: '记录标签分配来源、有效期和状态。' },
      { name: '授权变更集', kind: '运行', purpose: '批量授权或回收前生成可校验的变更计划。' },
      { name: '授权变更明细', kind: '台账', purpose: '记录每个账号的授权执行结果与错误。' },
      { name: '访问申请', kind: '审批', purpose: '提交、审批和跟踪访问权限申请。' },
      { name: '临时授权', kind: '运行', purpose: '管理带到期时间且可自动回收的权限。' }
    ]
  },
  {
    key: 'configuration',
    name: '配置与灰度',
    purpose: '统一配置基线、环境差异和功能灰度。',
    menus: [
      { name: '配置模板', kind: '配置', purpose: '维护不同环境可继承、可版本化的配置基线。' },
      { name: '配置漂移', kind: '处置', purpose: '发现并处理目标环境偏离配置基线的问题。' },
      { name: '功能开关', kind: '配置', purpose: '按用户、角色、部门或比例控制功能灰度。' }
    ]
  },
  {
    key: 'release',
    name: '发布治理',
    purpose: '让发布经过计划、审批、门禁、执行和审计。',
    menus: [
      { name: '发布计划', kind: '配置', purpose: '固定发布内容、门禁、步骤和回滚方案。' },
      { name: '发布审批', kind: '审批', purpose: '保存不可变审批结论并落实职责分离。' },
      { name: '发布运行', kind: '运行', purpose: '查看发布或回滚的断点、租约和执行状态。' },
      { name: '变更台账', kind: '台账', purpose: '汇总跨资源变更及其应用、验证证据。' }
    ]
  },
  {
    key: 'service',
    name: '服务治理',
    purpose: '管理服务目录、实例、路由策略和调用拓扑。',
    menus: [
      { name: '服务目录', kind: '配置', purpose: '登记服务身份、负责人和健康状态。' },
      { name: '服务实例', kind: '运行', purpose: '查看实例版本、区域、租约和排空状态。' },
      { name: '流量策略', kind: '配置', purpose: '配置版本路由、重试、限流、熔断和降级。' },
      { name: '调用结果', kind: '台账', purpose: '记录策略许可对应的真实调用结果。' },
      { name: '服务拓扑', kind: '台账', purpose: '聚合服务间调用量、错误量和延迟。' }
    ]
  },
  {
    key: 'observability',
    name: '可观测与日志',
    purpose: '把监控规则、告警处置、送达和日志生命周期连成闭环。',
    menus: [
      { name: '可观测策略', kind: '配置', purpose: '定义可信指标、阈值、窗口和严重级别。' },
      { name: '规则评估台账', kind: '台账', purpose: '记录每个时间窗口的规则评估证据。' },
      { name: '告警事件', kind: '处置', purpose: '查看、确认、恢复和关闭平台告警。' },
      { name: '告警路由', kind: '配置', purpose: '配置告警接收人、优先级和处理时限。' },
      { name: '告警送达', kind: '台账', purpose: '跟踪每次通知尝试、重试和送达结果。' },
      { name: '日志策略', kind: '配置', purpose: '设置日志热、温、冷阶段和归档方式。' },
      { name: '日志生命周期', kind: '运行', purpose: '查看日志扫描、归档和清理任务结果。' }
    ]
  },
  {
    key: 'asset',
    name: '资产与协作',
    purpose: '沉淀可复用资产并避免多人同时覆盖同一资源。',
    menus: [
      { name: '资产包', kind: '配置', purpose: '定义可复用、可安装的页面或配置资产集合。' },
      { name: '资产版本', kind: '台账', purpose: '保存资产不可变版本、内容哈希和兼容范围。' },
      { name: '协作租约', kind: '运行', purpose: '显示谁正在编辑资源并提供过期与防并发令牌。' }
    ]
  },
  {
    key: 'import',
    name: '数据迁移',
    purpose: '对大批量导入进行预检、分片执行、恢复和回滚。',
    menus: [
      { name: '导入批次', kind: '运行', purpose: '查看导入计划、进度、成功失败数和检查点。' },
      { name: '导入暂存行', kind: '台账', purpose: '查看每一行的计划动作、结果和错误原因。' }
    ]
  }
]

const governanceMenuOrder = governanceAreas.flatMap((area) => area.menus.map((item) => `AI平台治理·${item.name}`))
const governanceSortByName = new Map(governanceMenuOrder.map((name, index) => [name, (index + 1) * 10]))
const governanceModules = dataModules.map((item) => ({
  ...item,
  parentName: GOVERNANCE_ROOT_NAME,
  sort: governanceSortByName.get(item.name)
}))
const modules = [
  {
    name: GOVERNANCE_ROOT_NAME,
    Description: '集中管理门户、身份、授权、配置、发布、服务、可观测、资产与数据迁移治理。',
    parentId: SYSTEM_ENGINE_MENU_ID,
    icon: 'fas fa-shield-alt',
    display: 1,
    appDisplay: 1,
    openType: 'SecondMenu',
    sort: 9
  },
  {
    name: GOVERNANCE_WORKBENCH_NAME,
    Description: 'AI平台治理统一操作入口。',
    parentName: GOVERNANCE_ROOT_NAME,
    icon: 'fas fa-tachometer-alt',
    display: 1,
    appDisplay: 1,
    openType: 'MicroService',
    componentName: 'MicroService',
    componentPath: '/micro-app/host',
    url: '/micro-app/ai-platform-studio/overview',
    isMicroiService: 1,
    microServiceKey: 'ai-platform-studio',
    microServiceRoutePath: '/overview',
    sort: 1
  },
  ...governanceModules
]

const jobs = [
  {
    JobName: 'MciAiPlatformMinuteSweep',
    JobDesc: 'AI平台服务租约、协作租约、临时授权、标签有效期、告警评估、升级与可靠送达维护',
    CronDesc: '每分钟执行一次',
    CronExpression: '0 0/1 * * * ?',
    JobType: '1',
    ApiEngineKey: 'mci-platform-maintenance',
    JobParam: JSON.stringify({ Scope: 'LeasesAccessTagsAlertEvaluationAndDelivery' })
  }
]

const manifest = {
  name: 'Microi吾码 AI 平台治理中心',
  version: 'v2.0.4',
  description: '门户、身份目录、标签人群、访问申请、临时权限、灰度发布、服务实例、Trace、日志生命周期、告警升级、资产包、协作租约与可恢复导入的一体化平台治理能力。',
  menuCatalog: governanceAreas,
  tables,
  engines,
  events: [],
  modules,
  permissions: [{ roleId: 'admin', moduleNames: modules.map((item) => item.name) }],
  dataSources: [],
  pages: [],
  printTemplates: [],
  workflows: [],
  jobs
}

const resourcePolicies = {
  SchemaVersion: 1,
  ApiEngines: Object.fromEntries(engineSpecs.map(([key, , , policy]) => [key, {
    Ownership: policy === 'Managed' ? 'Application' : 'Tenant',
    UpgradePolicy: policy
  }]))
}

await Promise.all([
  writeFile(resolve(root, 'system.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  writeFile(resolve(root, 'resource-policies.json'), `${JSON.stringify(resourcePolicies, null, 2)}\n`, 'utf8'),
  writeFile(resolve(root, 'manifest-build.json'), `${JSON.stringify({ SchemaVersion: 1, Version: manifest.version, BuiltAt: now, TableCount: tables.length, ModuleCount: modules.length, WorkbenchModuleCount: 1, DataModuleCount: governanceModules.length, EngineCount: engines.length }, null, 2)}\n`, 'utf8')
])

console.log(`Microi AI平台治理 Manifest 已生成：${tables.length} 张表，${modules.length} 个菜单（1 个父菜单 + 1 个治理工作台 + ${governanceModules.length} 个数据菜单），${engines.length} 个接口引擎。`)
