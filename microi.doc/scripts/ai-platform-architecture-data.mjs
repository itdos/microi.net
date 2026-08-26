export const architectureVersion = '2026.08.27'
export const platformVersion = 'v7.7.2'

export const valueCards = [
  ['10×+', 'Token 更省'],
  ['10×+', '典型交付更快'],
  ['20+', '成熟引擎复用'],
  ['在线生效', 'V8 无需编译发布']
]

export const channels = [
  ['PC 管理端', 'Vue 3'], ['WebOS', '桌面多任务'], ['移动自适应', 'H5 / 触控'], ['UniApp / App', 'Android / iOS'],
  ['微信小程序', '多端复用'], ['AI 应用 / Agent', 'Web / UniApp'], ['前端微服务', '多页路由'], ['Microi.VSCode', '资源树 / 调试'],
  ['MCP / Skills', 'Codex / OpenClaw'], ['OpenAPI / SDK', 'HTTP / JS']
]

// 以当前中文官网的系统引擎入口为事实源，防止架构图只强调通用治理术语而漏掉真实产品能力。
export const officialSystemEngines = [
  'AI 引擎', 'V8引擎', '表单引擎', '模块引擎', '接口引擎', '数据源引擎', '界面引擎', '打印引擎',
  '报表引擎', '工作流引擎 v4', 'SaaS 引擎', '缓存引擎', '搜索引擎', '采集引擎', '任务调度', 'MQ 消息队列',
  'MQTT 引擎', '消息通知', '翻译引擎', 'OCR 引擎', '图片处理引擎', '文件柜 / HDFS', '模板引擎', 'Office 引擎',
  '前端微服务', 'Microi.UI', '多端客户端', '3D / CAD / 数据大屏', 'Unity / WebGL', '应用商城', '系统设置',
  '系统日志 / 监控', '扩展数据库', '蓝牙打印', 'AI 平台治理', 'AI 工作流 / 蓝图'
]

export const panels = [
  {
    x: 40, y: 232, w: 545, h: 314, code: '01', title: 'AI 开发与智能引擎', accent: '#4de8ff',
    subtitle: '模型、Agent、知识与 AI 交付',
    items: [
      'AI 引擎', '多模型网关', '智能模型路由', '密钥隔离',
      '流式对话', '多模态', 'AI 助手', 'AI 数据分析',
      '知识库 RAG', '向量检索', 'NL2SQL', 'NL2V8',
      'Agent', 'Tool Calling', 'Prompt 模板', '上下文记忆',
      'AI 应用工作台', 'AI 在线编程', 'AI 本地编程', 'Microi.VSCode',
      'MCP', 'Skills', 'CLI / Plugins', 'OpenClaw',
      '业务架构蓝图', '系统关系图谱', 'AI 工作流 / 蓝图', '状态机',
      'Automation Flow', '流程挖掘', 'Manifest 建模', 'Preview / Diff'
    ]
  },
  {
    x: 40, y: 566, w: 545, h: 314, code: '02', title: '低代码核心业务引擎', accent: '#b995ff',
    subtitle: '20+ 成熟引擎开箱复用',
    items: [
      '表单引擎', '模块引擎', '接口引擎', '数据源引擎',
      '界面引擎', '打印引擎', '报表引擎', '工作流引擎 v4',
      'SaaS 引擎', '应用商城', '模板引擎', 'Microi.UI',
      '40+ 表单控件', '主子表 / 关联表', '字段 / 表单 V8', '列表 / 搜索',
      '权限 / 数据范围', '左右树表', '移动卡片', 'ECharts / 地图',
      'Office 引擎', '蓝牙打印', '自定义导入导出', '定制组件',
      '前端微服务', '多端客户端', 'PC / WebOS', 'UniApp / App',
      '微信小程序', 'Unity / WebGL', '3D / CAD / 数据大屏', 'goView 数据大屏'
    ]
  },
  {
    x: 1335, y: 232, w: 545, h: 314, code: '03', title: '集成、数据与自动化引擎', accent: '#48e7a6',
    subtitle: '连接数据、服务、设备与内容',
    items: [
      '缓存引擎', '扩展数据库', '搜索引擎', '采集引擎',
      '任务调度', 'MQ 消息队列', 'MQTT 引擎', '消息通知',
      '翻译引擎', 'OCR 引擎', '图片处理引擎', '文件柜 / HDFS',
      'Redis / MongoDB', 'Elasticsearch', 'Dos.ORM', '多数据库',
      'MySQL / SQL Server', 'Oracle / PostgreSQL', '达梦 / 人大金仓', 'MinIO / OSS / S3',
      'HTTP 集成', 'TCP 原始字节', 'Webhook / 回调', 'SignalR 实时',
      'API / JSON 数据源', 'Excel / CSV 导入', 'Word / PPT 导出', '邮件 / 短信 / 微信',
      '地图 / 定位', '公众号 / 小程序', 'OpenAPI / SDK', 'gRPC / 多语言'
    ]
  },
  {
    x: 1335, y: 566, w: 545, h: 314, code: '04', title: '平台治理、安全与可靠运行', accent: '#ffbd59',
    subtitle: '设置、观测、租户与交付闭环',
    items: [
      'AI 平台治理', '系统设置', '系统日志 / 监控', '服务健康',
      'SaaS / OsClient', 'DiyToken', '角色 / 部门', '菜单 / 表权限',
      '行 / 字段权限', 'Passkey / TOTP', 'SSO / OAuth', 'OIDC / SAML / CAS',
      '租户 Secret', '审计 / Trace', '多节点 API', 'Worker 集群',
      '分布式租约', 'Fencing Token', '幂等 / 唯一约束', 'Outbox / Inbox',
      '优雅排空', '重启恢复', '限流 / 熔断 / 重试', '日志 / 告警',
      '健康检查', 'Docker / K8s', 'Managed Core', 'CreateIfMissing Hook',
      'Version / Hash', 'DryRun / Readback', '自动化测试', '浏览器验收'
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
    name: 'AI 开发与智能引擎',
    responsibility: '理解需求、设计系统、生成并校验变更',
    capabilities: ['AI 引擎', '多模型网关', 'RAG', 'NL2SQL / NL2V8', 'Agent / Tool Calling', 'MCP / Skills', '业务架构蓝图', 'AI 工作流', 'Preview / Diff']
  },
  {
    name: '低代码核心业务引擎',
    responsibility: '以 20+ 成熟引擎建模并运行企业业务',
    capabilities: ['表单', '模块', '接口', '数据源', '界面', '打印', '报表', '工作流', 'SaaS', '应用商城']
  },
  {
    name: 'V8 运行与集成核心',
    responsibility: '在线运行可信业务逻辑并连接平台原子能力',
    capabilities: ['接口引擎', 'FormEngine', '数据源', 'Dos.ORM', 'HTTP', 'Redis', 'MongoDB', 'MQ / MQTT', 'Office / OCR', 'Webhook / SignalR']
  },
  {
    name: '数据、集成与自动化引擎',
    responsibility: '连接数据库、服务、文件、设备与消息通道',
    capabilities: ['缓存', '扩展数据库', '搜索', '采集', '任务调度', 'MQ / MQTT', '通知', '翻译', 'OCR / 图片', 'HDFS']
  },
  {
    name: '平台治理、安全与可靠运行',
    responsibility: '统一设置、身份、权限、观测、升级与恢复',
    capabilities: ['AI 平台治理', '系统设置', '系统日志/监控', 'OsClient', 'DiyToken', 'SSO', '分布式租约', '幂等', 'Trace / 告警', 'Docker / K8s']
  },
  {
    name: '工程与全端交付生态',
    responsibility: '交付 PC、WebOS、移动端、微服务与 Unity 应用',
    capabilities: ['Microi.VSCode', 'Codex / OpenClaw', 'MCP', 'Skills', 'Microi.UI', '前端微服务', 'UniApp / App', 'Unity / WebGL', '自动化测试', '浏览器回读']
  }
]

export const architectureData = {
  architectureVersion,
  platformVersion,
  valueCards,
  channels,
  officialSystemEngines,
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
    ['系统引擎总览', officialSystemEngines],
    ['AI 开发与智能引擎', panels[0].items],
    ['低代码核心业务引擎', panels[1].items],
    ['集成、数据与自动化引擎', panels[2].items],
    ['平台治理、安全与可靠运行', panels[3].items],
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
