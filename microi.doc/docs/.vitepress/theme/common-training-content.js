// 两个版本共用同一份开场与价值文案，保证网页、搜索索引和导出课件保持一致。
export const trainingArchitectureImage = {
  src: 'https://file.microi.net/itdos/official-docs/images/af8f0aad7815c1f68e224cbce706d5723c5223bd1557e1eea71a19b45891d169/202610/microi-ai-platform-architecture-2026_10_25_1.svg',
  alt: 'Microi吾码 AI 平台系统架构图：AI 开发工具、30+ 引擎、分布式底座与多端交付',
}

export const trainingCoreBenefits = [
  { code: 'AI', title: 'AI 低代码开发', text: '让 AI 理解业务，复用成熟引擎完成开发。', tone: 'blue' },
  { code: 'V8', title: 'V8 引擎 AI 编程', text: '在线编排业务逻辑，保存即生效。', tone: 'purple' },
  { code: 'μ', title: '微服务定制', text: '复杂交互独立开发，业务体验自由扩展。', tone: 'cyan' },
  { code: '0', title: '0 代码自然语言构建大型系统', text: '从需求到数据、表单、流程与完整应用。', tone: 'green' },
  { code: '↯', title: '无需编译发布', text: '低代码配置与 V8 业务逻辑在线调整。', tone: 'amber' },
  { code: 'N', title: '微软 NuGet 下载量 1189万+', text: '截止2026年10月16日', tone: 'primary', statistic: true },
]

export const trainingTrustSignals = ['开源可控', '高性能分布式', 'SaaS 多租户', '多数据库', '跨平台全端', 'MCP + Skills']

export const trainingFrameworkTitle = '企业研发，为什么要先选一套开源 AI 开发框架？'

export const trainingFrameworkLayers = [
  { label: '前端框架', glyph: '◫', tone: 'blue' },
  { label: '后端框架', glyph: '⌘', tone: 'purple' },
  { label: '表单引擎', glyph: '▦', tone: 'primary' },
  { label: '工作流引擎', glyph: '⤳', tone: 'green' },
  { label: '打印引擎', glyph: '▤', tone: 'cyan' },
  { label: '分布式缓存', glyph: '⇄', tone: 'amber' },
  { label: '分布式存储', glyph: '▱', tone: 'blue' },
  { label: '更多框架与能力', glyph: '⋯', tone: 'purple' },
]

export const trainingFrameworkPaths = [
  {
    code: 'PATH A', title: 'Codex / WorkBuddy 直接开发软件', tone: 'amber',
    steps: ['业务需求', '自建通用底座', '逐项验证与维护'],
    text: '业务与架构同时研发：身份权限、表单、流程、存储、实时通信、部署治理，都需要团队逐项构建。',
    outcome: '产品能力与长期稳定性，取决于团队新建底座的完整程度。',
  },
  {
    code: 'PATH B', title: 'Codex / WorkBuddy + 系统框架底座', tone: 'green',
    steps: ['成熟系统架构', 'AI 聚焦业务差异', '验证并持续交付'],
    text: '在已经迭代、验证的框架上开发：复用通用引擎、权限、分布式能力与运维机制，集中完成业务。',
    outcome: '两条路径做出的软件产品，在完整度、可靠性与演进能力上会显著不同。',
  },
]

// 对照官网能力专题和技术版逐项归组；计数包含引擎与特色功能，不冒充独立引擎数量。
export const trainingEngineGroups = [
  { title: '应用引擎', tone: 'primary', engines: ['表单引擎', '模块引擎', '界面引擎', '模板引擎', '打印引擎', '报表引擎', '流程 / 工作流引擎', 'SaaS 多租户引擎', '邮箱系统', '文件柜'] },
  { title: '开发与交付', tone: 'blue', engines: ['V8 引擎', '接口引擎 / 类型化数据', '前端微服务', 'Microi.UI 组件库', '应用商城', 'Office 引擎 / 在线编辑', '多数据库 / Dos.ORM', 'Microi Agent 工作台', 'VS Code 插件 / CLI', 'MCP Server / Skills'] },
  { title: 'AI 与智能', tone: 'purple', engines: ['AI 引擎 / 模型中转', 'AI 数据分析', 'AI 创作中心', 'AI 工作流', '业务蓝图 / 状态机', '流程挖掘', 'AI 平台治理', 'AI 员工 / 吾码小龙虾', 'AI CAD / SolidWorks*', '数字人直播 / AI 换脸'] },
  { title: '集成与数据', tone: 'cyan', engines: ['L1 / L2 缓存引擎', '搜索引擎', '采集引擎', '任务调度 / 后台任务', 'MQ 消息队列引擎', 'MQTT 物联网引擎', '消息通知引擎', '分布式存储 / HDFS', '翻译 / 多语言引擎', 'HTTP / Socket / TCP 集成'] },
  { title: '视觉与运行', tone: 'green', engines: ['OCR 识别引擎', '视觉引擎', '图片处理引擎', '3D / CAD / 数据大屏', 'Unity / WebGL 集成', '蓝牙 / 网络打印', '系统日志 / 监控 / 链路', '安全 / SSO / 强身份', '服务器运维面板', 'PC / WebOS / 移动全端'] },
]
export const trainingAdditionalEngines = ['角色 / 部门 / 字段 / 数据权限', 'Passkey / TOTP / 第三方登录 / 人脸验证', '数据库迁移与备份 / 模块复制 / 文件同步', '远程逐行调试 / 自动测试 / 压测', 'H5 / 小程序 / Android / iOS', '系统设置 / 全局主题 / 水印']

// 静态课件冻结已回读的官方快照，网页与PDF使用同一数字和日期。
export const trainingWhyProof = { downloads: '1,207', date: '2026年10月18日', totalDownloads: 12070344, queriedAt: '2026-10-18T13:00:04.962Z' }
export const trainingBenefitNote = '* 典型平台能力高复用场景；实际收益取决于需求与团队基线。'
export const trainingWhyNote = '* Token 收益依需求与团队基线而异；AI CAD / SolidWorks 为技术预览。各能力配置与适用范围详见官方文档，欢迎与优秀框架全方位对比。'
export const trainingWhyAdvantages = [
  { code: 'AI', title: 'AI 低代码 · 0 代码自然语言', text: '从业务需求到数据、表单与完整系统。', tone: 'blue' },
  { code: 'V8', title: 'V8 引擎 AI 编程', text: '低代码与 V8 在线生效，无需编译发布。', tone: 'purple' },
  { code: '∞', title: '系统灵活性做到极致', text: '表单引擎图片 / 文件上传；模块引擎列、搜索、按钮、卡片等丰富配置。', tone: 'primary' },
  { code: 'μ', title: '微服务定制 · 源码扩展', text: '复杂交互自由扩展，跨平台全端交付。', tone: 'cyan' },
]

export const trainingDeliveryStages = ['AI 对话建模', '自动实现', '全自动测试', '受控发布', '运行治理']
