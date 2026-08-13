export const architectureVersion = '2026.08.12'

export const valueCards = [
  ['10×+', '更省 Token'],
  ['10×+', '更快开发'],
  ['几十+', '成熟引擎 · 更稳定'],
  ['开箱即用', '更快交付']
]

export const channels = [
  ['PC 管理端', 'Vue 3'], ['WebOS', '桌面多任务'], ['移动自适应', 'H5 / 触控'], ['UniApp / App', 'Android / iOS'],
  ['微信小程序', '多端复用'], ['AI 应用 / Agent', 'Web / UniApp'], ['前端微服务', '多页路由'], ['Microi.VSCode', '资源树 / 调试'],
  ['MCP / Skills', 'Codex / OpenClaw'], ['OpenAPI / SDK', 'HTTP / JS']
]

export const panels = [
  {
    x: 40, y: 232, w: 545, h: 314, code: '01', title: 'AI 智能与设计控制面', accent: '#4de8ff',
    subtitle: '自然语言 → 可审计系统变更',
    items: [
      '多模型网关', '智能模型路由', '密钥隔离', 'Token 统计',
      '流式对话', '多模态输入', '知识库 RAG', '向量检索',
      'NL2SQL', 'NL2V8', 'Agent', 'Tool Calling',
      'MCP 编排', 'Skills', 'Prompt 模板', '上下文记忆',
      'AI 应用工作台', '在线源码', '业务架构蓝图', '系统关系图谱',
      'AI Workflow', '状态机', 'Automation Flow', '流程挖掘',
      'Manifest 建模', '解决方案规划', '影响面分析', '代码生成',
      '测试计划生成', 'AI 辅助调试', '根因诊断', 'Preview / Diff'
    ]
  },
  {
    x: 40, y: 566, w: 545, h: 314, code: '02', title: '低代码与多端体验引擎', accent: '#b995ff',
    subtitle: '表单、页面、流程、报表与微应用',
    items: [
      '表单引擎', '40+ 控件', 'Tabs / 分组', '栅格布局',
      '主子表', '关联表单', '字段 V8 事件', '表单 V8 事件',
      '数据过滤', '模块引擎', '列表 / 搜索', '统计 / 角标',
      'PC 复合列', '移动卡片', '左右树表', '界面引擎',
      'JSON ↔ Vue', '源码预览', 'Undo / Redo', '页面版本',
      '语义 Diff', 'Microi.UI / 物料', '资产依赖', '打印引擎',
      '报表引擎', '审批流 v4', '模板引擎', 'Office / 蓝牙打印',
      '图表 / 地图 / 甘特', 'Unity / WebGL', '3D / CAD / 大屏', '前端微服务'
    ]
  },
  {
    x: 1335, y: 232, w: 545, h: 314, code: '03', title: 'AI 平台治理中心', accent: '#48e7a6',
    subtitle: '门户、身份、配置、发布全链路治理',
    items: [
      '门户项目', '命名插槽', '统一资产', '不可变快照',
      '原子发布', '运行解析', '身份连接器', 'SCIM 同步',
      '增量游标', '冲突重放', '动态用户组', '用户标签',
      '人群圈选', '批量授权', '权限解释', '临时权限',
      '组织快照', '配置模板', '配置继承', 'Secret 引用',
      '配置漂移', 'Feature Flag', '稳定灰度', '发布时间窗',
      '发布计划', '计划哈希', '不可变审批', '职责分离',
      '自动门禁', '断点续发', '条件回滚', '跨资源变更集'
    ]
  },
  {
    x: 1335, y: 566, w: 545, h: 314, code: '04', title: '服务、观测与可靠运行', accent: '#ffbd59',
    subtitle: '多节点事实源、告警闭环与可恢复任务',
    items: [
      '服务注册', '实例心跳', '共享租约', '优雅排空',
      '版本 / 区域', '标签 / 权重', '稳定路由', '限流许可',
      '熔断反馈', '重试 / 降级', '服务拓扑', 'W3C Trace',
      'Span 时间线', '日志信号', '告警规则', '窗口评估',
      '去重 / 抑制', '自动恢复', '值班排班', '升级链',
      'Outbox 送达', '热 / 温 / 冷', '留存 / 配额', '脱敏规则',
      '法律保留', '归档证明', '导入预检', '暂存行修正',
      '检查点 / 栅栏', '暂停 / 恢复', '条件回滚', '协作租约'
    ]
  }
]

export const v8Capabilities = [
  ['接口引擎', '保存即生效'], ['FormEngine', 'CRUD / _Where'], ['DataSource', 'SQL / API / JSON'], ['Db / Dos.ORM', '多数据库'],
  ['HTTP', 'GET / POST / PATCH'], ['Redis Cache', 'TTL / Hash'], ['MongoDB', '文档数据'], ['Search Engine', '索引 / 检索'],
  ['Job / Quartz', '可靠后台任务'], ['Spider Engine', '采集 / 浏览器'], ['MQ / RabbitMQ', 'Outbox / Inbox'], ['MQTT / IoT', '设备事件'],
  ['Files / HDFS', '流式资产'], ['Office', 'Excel / Word / PPT'], ['OCR / Image', '识别 / 图像处理'], ['Translate', '翻译 / 多语言'],
  ['Message Engine', '站内 / 多通道'], ['AI / Agent', '模型 / 工具'], ['Template', 'HTML / 文档'], ['Webhook / SignalR', '实时集成']
]

export const governanceLoop = [
  'Plan / DryRun', 'Confirm / Apply', 'Validate / Readback', 'Version / Hash', 'Audit / Trace', 'Rollback / Recover',
  'Managed Core', 'Tenant Hook', 'OsClient 隔离', '共享状态', '稳定幂等', '失败关闭'
]

export const foundations = [
  {
    title: '数据与存储底座', accent: '#57c9ff',
    items: ['MySQL', 'SQL Server', 'Oracle', 'PostgreSQL', '达梦', '金仓', 'Redis', 'MongoDB', 'Elasticsearch', 'MinIO / HDFS']
  },
  {
    title: '身份、安全与多租户', accent: '#b995ff',
    items: ['SaaS / OsClient', 'DiyToken', '角色 / 部门', '菜单 / 表权限', '行 / 字段权限', 'Access Key', 'Passkey / TOTP', 'SSO / OAuth', '强身份票据', '认证加密']
  },
  {
    title: '分布式运行底座', accent: '#48e7a6',
    items: ['多节点 API', 'Worker 集群', '分布式租约', 'Fencing Token', '幂等 / 唯一约束', 'Outbox / Inbox', 'WAL / Spool', '重启恢复', '健康检查', 'Docker / K8s']
  },
  {
    title: '工程、生态与交付', accent: '#ffbd59',
    items: ['应用商城', 'Managed', 'CreateIfMissing', 'MCP', 'Microi.VSCode', 'CLI / Plugins', 'Skills', '官方文档', '自动化测试', '浏览器回读']
  }
]

export const deliveryFlow = ['自然语言', '业务蓝图', 'Manifest', 'DryRun', '确认执行', '自动校验', '真实回读', '安全回滚']

export const architectureLayers = [
  {
    name: 'AI 智能与设计控制面',
    responsibility: '理解需求、设计系统、生成并校验变更',
    capabilities: ['多模型网关', 'RAG', 'NL2SQL / NL2V8', 'Agent / Tool Calling', 'MCP / Skills', '业务架构蓝图', 'AI Workflow', 'Manifest', 'Preview / Diff']
  },
  {
    name: '低代码与多端体验层',
    responsibility: '建模业务并交付 PC、WebOS、移动端和微应用',
    capabilities: ['表单', '模块', '界面', '工作流', '打印', '报表', 'Microi.UI', '前端微服务', 'UniApp / App', 'Unity / WebGL']
  },
  {
    name: 'V8 运行与集成核心',
    responsibility: '在线运行可信业务逻辑并连接平台原子能力',
    capabilities: ['接口引擎', 'FormEngine', '数据源', 'Dos.ORM', 'HTTP', 'Redis', 'MongoDB', 'MQ / MQTT', 'Office / OCR', 'Webhook / SignalR']
  },
  {
    name: 'AI 平台治理中心',
    responsibility: '治理门户、身份、配置、发布和跨资源变更',
    capabilities: ['门户项目', '身份连接器', '动态用户组', '配置模板', 'Feature Flag', '灰度发布', '不可变审批', '断点续发', '条件回滚']
  },
  {
    name: '企业可靠性与安全底座',
    responsibility: '保障多租户、多节点、安全、观测和恢复',
    capabilities: ['OsClient 隔离', 'DiyToken', 'Passkey / TOTP', '分布式租约', '幂等', 'Outbox / Inbox', 'Trace / 日志 / 告警', '健康检查', 'Docker / K8s']
  },
  {
    name: '工程与交付生态',
    responsibility: '把开发、测试、升级、文档和 AI 协作连成闭环',
    capabilities: ['Microi.VSCode', 'Codex / OpenClaw', 'MCP', 'Skills', '应用商城', 'Managed / CreateIfMissing', '自动化测试', '浏览器回读', '官方文档']
  }
]

export const architectureData = {
  architectureVersion,
  valueCards,
  channels,
  panels: panels.map(({ code, title, subtitle, items }) => ({ code, title, subtitle, items })),
  v8Capabilities,
  governanceLoop,
  foundations: foundations.map(({ title, items }) => ({ title, items })),
  deliveryFlow,
  architectureLayers
}

export function architectureFeatureSections() {
  return [
    ['平台价值', valueCards.flat()],
    ['全端入口', channels.flat()],
    ['AI 智能与设计控制面', panels[0].items],
    ['低代码与多端体验引擎', panels[1].items],
    ['AI 平台治理中心', panels[2].items],
    ['服务、观测与可靠运行', panels[3].items],
    ['V8 运行与集成核心', [...v8Capabilities.flat(), '事务', '权限', '多租户', '多节点']],
    ['统一治理与交付闭环', governanceLoop],
    ...foundations.map(item => [item.title, item.items]),
    ['AI 交付流水线', deliveryFlow]
  ]
}

export function architectureFeatureLabels() {
  return [...new Set(architectureFeatureSections().flatMap(([, items]) => items))]
}

export function buildArchitectureMarkdown(sourceHash) {
  const rows = architectureLayers.map(layer =>
    `| **${layer.name}** | ${layer.responsibility} | ${layer.capabilities.join('、')} |`
  )
  const sections = architectureFeatureSections().map(([title, items]) =>
    `- **${title}：** ${items.join('、')}`
  )
  return [
    '<!-- MICROI_ARCHITECTURE_CAPABILITIES:START -->',
    `<!-- capability-source-sha256:${sourceHash} -->`,
    '| 架构层 | 核心职责 | 关键能力 |',
    '|---|---|---|',
    ...rows,
    '',
    `**AI 交付链路：** ${deliveryFlow.join(' → ')}`,
    '',
    '<details>',
    `<summary>查看架构图完整功能索引（${architectureFeatureLabels().length} 个唯一标签）</summary>`,
    '',
    ...sections,
    '',
    '</details>',
    '<!-- MICROI_ARCHITECTURE_CAPABILITIES:END -->'
  ].join('\n')
}
