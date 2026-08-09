import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const builtAt = '2026-08-09 00:00:00'

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

const textArea = (name, label, sort, tab, description = '') => field(
  name,
  label,
  'mediumtext',
  'Textarea',
  { sort, tab, formWidth: 24, description }
)

const jsonField = (name, label, sort, tab, description = '') => field(
  name,
  label,
  'longtext',
  'CodeEditor',
  {
    sort,
    tab,
    formWidth: 24,
    description: description || `${label}必须为有效 JSON，且不得包含 Token、Cookie、API Key 或密码。`
  }
)

const table = (name, description, fields, indexes, tabs = []) => ({
  name,
  description,
  column: 2,
  v8Unlimited: false,
  ...(tabs.length ? { tabs } : {}),
  fields,
  indexes
})

const statusOptions = option([
  ['Queued', '待处理'], ['Researching', '研究中'], ['Drafting', '生成中'],
  ['QualityReview', '质量审核'], ['Ready', '可发布'], ['Publishing', '发布中'],
  ['PartiallyPublished', '部分发布'], ['Published', '已发布'],
  ['BlockedQuality', '质量阻断'], ['NeedsReview', '需要复核'], ['Failed', '失败']
])

const tables = [
  table('mci_ai_content_plan', 'AI内容创作与发布计划', [
    field('PlanKey', '计划Key', 'varchar(100)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '计划名称', 'varchar(200)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Enabled', '启用', 'int', 'Switch', { defaultValue: '1', sort: 30 }),
    field('Timezone', '时区', 'varchar(100)', 'Text', { defaultValue: 'Asia/Shanghai', sort: 40 }),
    field('MorningEnabled', '08:30任务', 'int', 'Switch', { defaultValue: '1', sort: 50 }),
    field('AfternoonEnabled', '16:30任务', 'int', 'Switch', { defaultValue: '1', sort: 60 }),
    field('DefaultAiModel', '默认AI模型', 'varchar(200)', 'Text', { sort: 70 }),
    textArea('ArticlePrompt', '文章长期规范', 80, 'prompt', '用于补充文章语气、结构和证据要求，不得放任何密钥。'),
    textArea('VideoPrompt', '视频长期规范', 90, 'prompt', '用于补充非广告办公室场景和视频叙事要求。'),
    jsonField('TargetPolicyJson', '目标平台策略', 100, 'policy'),
    jsonField('QualityPolicyJson', '质量门禁策略', 110, 'policy'),
    field('LastDispatchTime', '最近派发时间', 'varchar(25)', 'DateTime', { tab: 'runtime', sort: 120 }),
    field('Remark', '备注', 'varchar(2000)', 'Textarea', { tab: 'runtime', formWidth: 24, sort: 130 })
  ], [
    { name: 'uk_mci_ai_content_plan_key', columns: ['PlanKey'], unique: true, purpose: '计划稳定业务键' },
    { name: 'idx_mci_ai_content_plan_enabled_update', columns: ['Enabled', 'UpdateTime'], unique: false, purpose: '启用计划列表' }
  ], [
    { Id: 'prompt', Name: '创作规范', Sort: 10 },
    { Id: 'policy', Name: '平台与质量策略', Sort: 20 },
    { Id: 'runtime', Name: '运行状态', Sort: 30 }
  ]),
  table('mci_ai_content_source', 'AI内容可信资料快照', [
    field('SourceKey', '资料Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('Name', '资料名称', 'varchar(300)', 'Text', { notEmpty: 1, sort: 20 }),
    field('SourceType', '资料类型', 'varchar(50)', 'Select', { configSource: option([['Website', '官网'], ['Docs', '官方文档'], ['Repository', '源码'], ['MCP', 'MCP回读'], ['Custom', '人工核验']]), sort: 30 }),
    field('SourceUrl', '来源地址', 'varchar(2000)', 'Text', { sort: 40 }),
    field('LocalPath', '本地源码路径', 'varchar(2000)', 'Text', { sort: 50 }),
    field('TrustLevel', '可信级别', 'varchar(50)', 'Select', { configSource: option([['Primary', '一手资料'], ['Verified', '已核验'], ['Reference', '仅参考']]), sort: 60 }),
    field('Enabled', '启用', 'int', 'Switch', { defaultValue: '1', sort: 70 }),
    textArea('SourceSnapshot', '已核验资料快照', 80, 'snapshot', '保存已核验摘录或结构化事实；不要保存整篇受版权保护的文章。'),
    field('SourceHash', '快照SHA-256', 'varchar(100)', 'Text', { tab: 'snapshot', sort: 90 }),
    field('LastVerifiedTime', '最近核验时间', 'varchar(25)', 'DateTime', { tab: 'snapshot', sort: 100 }),
    field('Notes', '证据边界', 'varchar(2000)', 'Textarea', { tab: 'snapshot', formWidth: 24, sort: 110 })
  ], [
    { name: 'uk_mci_ai_content_source_key', columns: ['SourceKey'], unique: true, purpose: '资料稳定业务键' },
    { name: 'idx_mci_ai_content_source_enabled_verified', columns: ['Enabled', 'LastVerifiedTime'], unique: false, purpose: '生成前读取已启用资料' }
  ], [{ Id: 'snapshot', Name: '证据快照', Sort: 10 }]),
  table('mci_ai_content_item', 'AI内容稿件与时段事实', [
    field('SlotKey', '时段幂等Key', 'varchar(120)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('PlanId', '计划Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Title', '标题', 'varchar(500)', 'Text', { sort: 30 }),
    field('Angle', '创作角度', 'varchar(1000)', 'Textarea', { formWidth: 24, sort: 40 }),
    field('ContentType', '内容类型', 'varchar(50)', 'Select', { configSource: option([['Article', '长文章'], ['ImageText', '原生图文'], ['Video', '视频'], ['Mixed', '多形态']]), defaultValue: 'Mixed', sort: 50 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: statusOptions, defaultValue: 'Queued', sort: 60 }),
    field('AiModel', '生成模型', 'varchar(200)', 'Text', { sort: 70 }),
    field('Summary', '摘要', 'varchar(2000)', 'Textarea', { formWidth: 24, sort: 80 }),
    field('Markdown', 'Markdown正文', 'longtext', 'CodeEditor', { formWidth: 24, sort: 90 }),
    field('Html', 'HTML正文', 'longtext', 'CodeEditor', { formWidth: 24, sort: 100 }),
    jsonField('SourceEvidenceJson', '来源证据', 110, 'quality'),
    field('QualityScore', '质量分', 'int', 'NumberText', { tab: 'quality', sort: 120 }),
    field('QualityStatus', '质量状态', 'varchar(50)', 'Select', { tab: 'quality', configSource: option([['Pending', '待审核'], ['Approved', '已通过'], ['Blocked', '已阻断']]), sort: 130 }),
    jsonField('QualityResultJson', '质量门禁结果', 140, 'quality'),
    jsonField('PublicUrlsJson', '公开页面回读', 150, 'publish'),
    field('GeneratedTime', '生成时间', 'varchar(25)', 'DateTime', { tab: 'publish', sort: 160 }),
    field('PublishedTime', '完成时间', 'varchar(25)', 'DateTime', { tab: 'publish', sort: 170 }),
    field('LastError', '最近错误', 'varchar(2000)', 'Textarea', { tab: 'publish', formWidth: 24, sort: 180 })
  ], [
    { name: 'uk_mci_ai_content_item_slot', columns: ['SlotKey'], unique: true, purpose: '跨节点时段幂等' },
    { name: 'idx_mci_ai_content_item_status_update', columns: ['Status', 'UpdateTime'], unique: false, purpose: '内容工作队列' },
    { name: 'idx_mci_ai_content_item_plan_time', columns: ['PlanId', 'CreateTime'], unique: false, purpose: '计划内容时间线' }
  ], [
    { Id: 'quality', Name: '质量与证据', Sort: 10 },
    { Id: 'publish', Name: '发布结果', Sort: 20 }
  ]),
  table('mci_ai_content_asset', 'AI内容图片、截图和视频资产', [
    field('AssetKey', '资产幂等Key', 'varchar(160)', 'Text', { tab: 'base', notEmpty: 1, unique: 1, sort: 10 }),
    field('ContentId', '内容Id', 'varchar(50)', 'Text', { tab: 'base', notEmpty: 1, sort: 20 }),
    field('AssetType', '资产类型', 'varchar(50)', 'Select', { tab: 'base', configSource: option([['Cover', '封面'], ['BodyImage', '正文图'], ['Screenshot', '真实截图'], ['ImageCard', '竖版卡片'], ['VideoFirstFrame', '视频首帧'], ['Video', '视频']]), sort: 30 }),
    field('Platform', '目标平台', 'varchar(100)', 'Text', { tab: 'base', sort: 40 }),
    field('SequenceNo', '顺序', 'int', 'NumberText', { tab: 'base', sort: 50 }),
    field('Prompt', '生成提示词', 'mediumtext', 'Textarea', { tab: 'generation', formWidth: 24, sort: 60 }),
    field('FirstFrameUrl', '首帧HTTPS地址', 'mediumtext', 'Text', { tab: 'generation', sort: 70 }),
    field('FileUrl', '资产地址', 'mediumtext', 'Text', { tab: 'generation', sort: 80 }),
    field('MiniMaxTaskHandle', 'MiniMax任务句柄', 'mediumtext', 'Text', { tab: 'generation', sort: 90, description: '服务器签名句柄，不是原始 task_id。' }),
    field('MiniMaxFileHandle', 'MiniMax文件句柄', 'mediumtext', 'Text', { tab: 'generation', sort: 100, description: '服务器签名句柄，不是原始 file_id。' }),
    field('Model', '生成模型', 'varchar(200)', 'Text', { tab: 'generation', sort: 110 }),
    field('Duration', '视频秒数', 'int', 'NumberText', { tab: 'generation', sort: 120 }),
    field('Resolution', '分辨率', 'varchar(50)', 'Text', { tab: 'generation', sort: 130 }),
    field('Status', '状态', 'varchar(50)', 'Select', { tab: 'review', configSource: option([['Draft', '待生成'], ['Queueing', '排队中'], ['Processing', '生成中'], ['ReviewRequired', '待验片'], ['Approved', '已通过'], ['Rejected', '已拒绝'], ['Failed', '失败']]), sort: 140 }),
    field('ReviewStatus', '审核状态', 'varchar(50)', 'Select', { tab: 'review', configSource: option([['Pending', '待审核'], ['Approved', '已通过'], ['Rejected', '已拒绝']]), sort: 150 }),
    field('QualityScore', '质量分', 'int', 'NumberText', { tab: 'review', sort: 160 }),
    field('QualityReview', '质量审核说明', 'mediumtext', 'Textarea', { tab: 'review', formWidth: 24, sort: 170 })
  ], [
    { name: 'uk_mci_ai_content_asset_key', columns: ['AssetKey'], unique: true, purpose: '资产稳定幂等键' },
    { name: 'idx_mci_ai_content_asset_content_status', columns: ['ContentId', 'Status'], unique: false, purpose: '稿件资产与验片列表' },
    { name: 'idx_mci_ai_content_asset_platform_sequence', columns: ['ContentId', 'Platform', 'SequenceNo'], unique: false, purpose: '平台图文卡片排序' }
  ], [
    { Id: 'base', Name: '资产归属', Sort: 10 },
    { Id: 'generation', Name: '生成与文件', Sort: 20 },
    { Id: 'review', Name: '人工验片', Sort: 30 }
  ]),
  table('mci_ai_publish_task', '多平台发布持久队列', [
    field('IdempotencyKey', '发布幂等Key', 'varchar(200)', 'Text', { notEmpty: 1, unique: 1, sort: 10 }),
    field('ContentId', '内容Id', 'varchar(50)', 'Text', { notEmpty: 1, sort: 20 }),
    field('Platform', '平台', 'varchar(100)', 'Text', { notEmpty: 1, sort: 30 }),
    field('AccountId', '帐号标识', 'varchar(200)', 'Text', { notEmpty: 1, sort: 40 }),
    field('AccountName', '帐号名称', 'varchar(300)', 'Text', { sort: 50 }),
    field('ContentMode', '发布形态', 'varchar(50)', 'Select', { configSource: option([['Article', '长文章'], ['ImageText', '原生图文'], ['Video', '视频']]), sort: 60 }),
    field('Status', '状态', 'varchar(50)', 'Select', { configSource: option([['Pending', '待认领'], ['Claimed', '已认领'], ['Publishing', '发布中'], ['Retry', '安全重试'], ['Succeeded', '成功'], ['Failed', '失败'], ['BlockedQuality', '质量阻断'], ['NeedsReview', '结果不确定']]), sort: 70 }),
    jsonField('PayloadJson', '非敏感发布参数', 80, 'payload', '只能保存公开内容参数，禁止保存 Token、Cookie、clientId、apiKey 或密码。'),
    field('AttemptCount', '尝试次数', 'int', 'NumberText', { tab: 'runtime', defaultValue: '0', sort: 90 }),
    field('MaxAttempts', '最大安全尝试', 'int', 'NumberText', { tab: 'runtime', defaultValue: '3', sort: 100 }),
    field('NextRetryTime', '下次安全重试', 'varchar(25)', 'DateTime', { tab: 'runtime', sort: 110 }),
    field('LeaseOwner', '租约持有者', 'varchar(300)', 'Text', { tab: 'runtime', sort: 120 }),
    field('LeaseUntil', '租约到期', 'varchar(25)', 'DateTime', { tab: 'runtime', sort: 130 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { tab: 'runtime', defaultValue: '0', sort: 140 }),
    field('RemoteTaskId', '平台任务Id', 'varchar(500)', 'Text', { tab: 'result', sort: 150 }),
    field('PublicUrl', '公开URL', 'mediumtext', 'Text', { tab: 'result', sort: 160 }),
    field('LastError', '最近错误', 'mediumtext', 'Textarea', { tab: 'result', formWidth: 24, sort: 170 }),
    field('CompletedTime', '完成时间', 'varchar(25)', 'DateTime', { tab: 'result', sort: 180 })
  ], [
    { name: 'uk_mci_ai_publish_task_idempotency', columns: ['IdempotencyKey'], unique: true, purpose: '帐号级外部发布副作用幂等' },
    { name: 'idx_mci_ai_publish_task_claim', columns: ['Status', 'NextRetryTime', 'LeaseUntil', 'CreateTime'], unique: false, purpose: '多节点连接器认领队列' },
    { name: 'idx_mci_ai_publish_task_content_status', columns: ['ContentId', 'Status'], unique: false, purpose: '稿件发布终态汇总' }
  ], [
    { Id: 'payload', Name: '发布参数', Sort: 10 },
    { Id: 'runtime', Name: '租约与重试', Sort: 20 },
    { Id: 'result', Name: '平台结果', Sort: 30 }
  ]),
  table('mci_ai_publish_attempt', '平台发布尝试与回读证据', [
    field('AttemptKey', '尝试幂等Key', 'varchar(200)', 'Text', { tab: 'identity', notEmpty: 1, unique: 1, sort: 10 }),
    field('PublishTaskId', '发布任务Id', 'varchar(50)', 'Text', { tab: 'identity', notEmpty: 1, sort: 20 }),
    field('AttemptNo', '尝试序号', 'int', 'NumberText', { tab: 'identity', sort: 30 }),
    field('FencingToken', '栅栏令牌', 'bigint', 'NumberText', { tab: 'identity', sort: 40 }),
    field('Status', '结果', 'varchar(50)', 'Select', { tab: 'result', configSource: option([['Succeeded', '成功'], ['Failed', '失败'], ['NeedsReview', '结果不确定'], ['BlockedQuality', '质量阻断']]), sort: 50 }),
    field('StartedTime', '开始时间', 'varchar(25)', 'DateTime', { tab: 'result', sort: 60 }),
    field('FinishedTime', '结束时间', 'varchar(25)', 'DateTime', { tab: 'result', sort: 70 }),
    field('RemoteTaskId', '平台任务Id', 'varchar(500)', 'Text', { tab: 'result', sort: 80 }),
    field('PublicUrl', '公开URL', 'mediumtext', 'Text', { tab: 'result', sort: 90 }),
    field('ArtifactHash', '稿件/资产哈希', 'varchar(100)', 'Text', { tab: 'result', sort: 100 }),
    field('PublisherNode', '连接器节点', 'varchar(300)', 'Text', { tab: 'result', sort: 110 }),
    field('ResponseSummary', '非敏感响应摘要', 'mediumtext', 'Textarea', { tab: 'evidence', formWidth: 24, sort: 120 }),
    field('ErrorCode', '错误码', 'varchar(200)', 'Text', { tab: 'evidence', sort: 130 }),
    field('ErrorMessage', '错误说明', 'mediumtext', 'Textarea', { tab: 'evidence', formWidth: 24, sort: 140 })
  ], [
    { name: 'uk_mci_ai_publish_attempt_key', columns: ['AttemptKey'], unique: true, purpose: '结果回写幂等' },
    { name: 'idx_mci_ai_publish_attempt_task_no', columns: ['PublishTaskId', 'AttemptNo'], unique: false, purpose: '发布任务尝试时间线' }
  ], [
    { Id: 'identity', Name: '尝试身份', Sort: 10 },
    { Id: 'result', Name: '平台结果', Sort: 20 },
    { Id: 'evidence', Name: '响应与错误证据', Sort: 30 }
  ])
]

const engineSpecs = [
  ['mci-ai-content-overview', 'AI内容运营总览', 'mci_ai_content_overview.js', 'Managed', 0],
  ['mci-ai-content-dispatch', 'AI内容时段派发', 'mci_ai_content_dispatch.js', 'Managed', 1],
  ['mci-ai-content-generate', '在线AI生成文章', 'mci_ai_content_generate.js', 'Managed', 0],
  ['mci-ai-content-quality-gate', '内容平台质量门禁', 'mci_ai_content_quality_gate.js', 'Managed', 0],
  ['mci-ai-video-submit', 'MiniMax视频任务创建', 'mci_ai_video_submit.js', 'Managed', 0],
  ['mci-ai-video-refresh', 'MiniMax视频任务回读', 'mci_ai_video_refresh.js', 'Managed', 0],
  ['mci-ai-publish-prepare', '多平台发布队列准备', 'mci_ai_publish_prepare.js', 'Managed', 0],
  ['mci-ai-publish-claim', '本机连接器认领发布任务', 'mci_ai_publish_claim.js', 'Managed', 0],
  ['mci-ai-publish-complete', '本机连接器提交发布结果', 'mci_ai_publish_complete.js', 'Managed', 0],
  ['mci-ai-scheduler-reconcile', 'AI内容任务调度元数据校准', 'mci_ai_scheduler_reconcile.js', 'Managed', 0],
  ['mci-ai-publish-adapter-extension', '租户发布参数扩展', 'mci_ai_publish_adapter_extension.js', 'CreateIfMissing', 1]
]

const engines = await Promise.all(engineSpecs.map(async ([apiEngineKey, apiName, file, policy, stopHttp]) => ({
  apiEngineKey,
  apiName,
  category: 'Microi AI内容创作与发布',
  v8Unlimited: false,
  stopHttp,
  allowAnonymous: 0,
  code: await readFile(resolve(root, 'engines', file), 'utf8')
})))

const buttonIds = {
  'mci-ai-content-generate': '01KZKB8A000000000000000001',
  'mci-ai-content-quality-gate': '01KZKB8A000000000000000002',
  'mci-ai-video-submit': '01KZKB8A000000000000000003',
  'mci-ai-video-refresh': '01KZKB8A000000000000000004',
  'mci-ai-scheduler-reconcile': '01KZKB8A000000000000000005'
}

const rowButton = (name, style, engine, show = 'V8.Result=true;') => ({
  Id: buttonIds[engine],
  Name: name,
  BtnStyle: style,
  V8CodeShow: show,
  V8Code: `var r=await V8.ApiEngine.Run('${engine}',{ContentId:V8.Form.Id,AssetId:V8.Form.Id});V8.Tips(r.Msg||(r.Code==1?'操作成功':'操作失败'),r.Code==1);if(r.Code==1){V8.RefreshTable({_PageIndex:1});}V8.Result=r;`
})

const hiddenFieldsByTable = {
  mci_ai_content_asset: ['MiniMaxTaskHandle', 'MiniMaxFileHandle'],
  mci_ai_publish_task: ['LeaseOwner', 'PayloadJson']
}

const module = (name, tableName, listFields, searchFields, mobileFields, moreBtns = []) => ({
  name,
  table: tableName,
  icon: 'fas fa-robot',
  display: 1,
  appDisplay: 1,
  listFields,
  searchFields,
  sortFields: ['CreateTime', 'UpdateTime'],
  hiddenFields: ['Id', 'IsDeleted', ...(hiddenFieldsByTable[tableName] || [])],
  mobileFields,
  cardTitleFields: listFields.filter((item) => /Status|Type|Platform/.test(item)).slice(0, 2),
  cardBottomFields: listFields.filter((item) => /Time|Score|Count/.test(item)).slice(0, 2),
  defaultOrderBy: [{ field: 'UpdateTime', type: 'DESC' }],
  enableViewSchema: 1,
  viewSchemaVersion: '1.0',
  viewConfigVersion: 1,
  ...(moreBtns.length ? { moreBtns } : {})
})

const modules = [
  module('AI内容计划', 'mci_ai_content_plan', ['PlanKey', 'Name', 'Enabled', 'DefaultAiModel', 'LastDispatchTime'], ['PlanKey', 'Name', 'Enabled'], ['Name', 'Enabled', 'LastDispatchTime'], [
    rowButton('启用/校准定时发布', 'success', 'mci-ai-scheduler-reconcile', "V8.Result=V8.CurrentUser&&(String(V8.CurrentUser.Account||'').toLowerCase()=='admin'||Number(V8.CurrentUser.Level||0)>=9999);")
  ]),
  module('AI资料来源', 'mci_ai_content_source', ['SourceKey', 'Name', 'SourceType', 'TrustLevel', 'Enabled', 'LastVerifiedTime'], ['SourceKey', 'Name', 'SourceType', 'TrustLevel'], ['Name', 'SourceType', 'LastVerifiedTime']),
  module('AI内容稿件', 'mci_ai_content_item', ['SlotKey', 'Title', 'ContentType', 'Status', 'QualityStatus', 'QualityScore', 'GeneratedTime'], ['SlotKey', 'Title', 'Status', 'QualityStatus'], ['Title', 'Status', 'QualityScore'], [
    rowButton('在线AI生成', 'primary', 'mci-ai-content-generate', "V8.Result=['Queued','NeedsReview','Failed'].indexOf(V8.Form.Status)>=0;"),
    rowButton('执行质量门禁', 'warning', 'mci-ai-content-quality-gate', "V8.Result=['QualityReview','Ready','BlockedQuality','NeedsReview'].indexOf(V8.Form.Status)>=0;")
  ]),
  module('AI内容素材', 'mci_ai_content_asset', ['AssetKey', 'ContentId', 'AssetType', 'Platform', 'SequenceNo', 'Status', 'ReviewStatus', 'QualityScore'], ['AssetKey', 'ContentId', 'AssetType', 'Platform', 'Status'], ['AssetType', 'Platform', 'Status'], [
    rowButton('提交MiniMax视频', 'primary', 'mci-ai-video-submit', "V8.Result=V8.Form.AssetType=='Video'&&['Draft','Failed'].indexOf(V8.Form.Status)>=0;"),
    rowButton('刷新视频状态', 'success', 'mci-ai-video-refresh', "V8.Result=V8.Form.AssetType=='Video'&&['Queueing','Processing'].indexOf(V8.Form.Status)>=0;")
  ]),
  module('AI发布队列', 'mci_ai_publish_task', ['Platform', 'AccountName', 'ContentMode', 'Status', 'AttemptCount', 'NextRetryTime', 'CompletedTime'], ['Platform', 'AccountName', 'ContentMode', 'Status'], ['Platform', 'AccountName', 'Status']),
  module('AI发布记录', 'mci_ai_publish_attempt', ['PublishTaskId', 'AttemptNo', 'Status', 'RemoteTaskId', 'PublicUrl', 'FinishedTime'], ['PublishTaskId', 'Status', 'RemoteTaskId'], ['Status', 'RemoteTaskId', 'FinishedTime'])
]

const jobs = [
  {
    JobName: 'MciAiContentMorning',
    JobDesc: '每天08:30创建AI内容上午时段',
    CronDesc: '每天08:30 Asia/Shanghai',
    CronExpression: '0 30 8 * * ?',
    TimeZoneId: 'Asia/Shanghai',
    JobType: '1',
    ApiEngineKey: 'mci-ai-content-dispatch',
    JobParam: JSON.stringify({ PlanKey: 'microi-ai-content-default', Slot: 'am', Timezone: 'Asia/Shanghai' })
  },
  {
    JobName: 'MciAiContentAfternoon',
    JobDesc: '每天16:30创建AI内容下午时段',
    CronDesc: '每天16:30 Asia/Shanghai',
    CronExpression: '0 30 16 * * ?',
    TimeZoneId: 'Asia/Shanghai',
    JobType: '1',
    ApiEngineKey: 'mci-ai-content-dispatch',
    JobParam: JSON.stringify({ PlanKey: 'microi-ai-content-default', Slot: 'pm', Timezone: 'Asia/Shanghai' })
  }
]

const manifest = {
  name: 'Microi吾码 AI 内容创作与发布',
  version: 'v1.0.4',
  description: '在线AI文章生成、MiniMax视频、短视频平台质量门禁、持久发布队列与本机多平台连接器协同。',
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
  writeFile(resolve(root, 'manifest-build.json'), `${JSON.stringify({
    SchemaVersion: 1,
    Version: manifest.version,
    BuiltAt: builtAt,
    TableCount: tables.length,
    ModuleCount: modules.length,
    EngineCount: engines.length,
    JobCount: jobs.length
  }, null, 2)}\n`, 'utf8')
])

console.log(`AI内容创作与发布 Manifest 已生成：${tables.length} 张表，${modules.length} 个模块，${engines.length} 个接口引擎，${jobs.length} 个任务。`)
