// 企业版只讲业务价值、公开案例与交付决策；同一份数据供在线演示、搜索和两种主题 PDF 使用。
// 案例引用沿用官网公开称谓和原始能力描述，不推断客户收益，也不把产品方向写成已交付案例。
/**
 * @typedef {object} EnterpriseSlideDraft
 * @property {string} id
 * @property {string} chapter
 * @property {'enterprise'} kind
 * @property {'cover'|'cards'|'case'|'flow'|'closing'} layout
 * @property {string} nav
 * @property {string} title
 * @property {string} summary
 * @property {string} eyebrow
 * @property {string} [lead]
 * @property {Array<{title:string,text:string,label?:string}>} [cards]
 * @property {string[]} [steps]
 * @property {Array<{value:string,label:string,note?:string}>} [metrics]
 * @property {string} [takeaway]
 * @property {Array<{label:string,href:string}>} [sources]
 * @property {{src:string,alt:string,caption:string}|null} [image]
 */

/** @type {EnterpriseSlideDraft[]} */
const enterpriseSlideDefinitions = [
  {
    id: 'enterprise-opening', chapter: '01', kind: 'enterprise', layout: 'cover', nav: '企业应用开场',
    title: '把企业的想法，变成真正可用的产品',
    summary: 'Microi吾码企业应用版：从真实行业案例，认识业务产品、关键优势与 AI 交付价值。',
    eyebrow: '企业应用版 · 面向客户、领导与经营者',
    lead: '今天只回答三个问题：吾码能做什么，为什么值得选，怎样证明做出来的东西能用。',
    cards: [
      { label: '业务', title: '能解决什么问题', text: '让订单、客户、审批、生产与经营数据进入同一条工作链。' },
      { label: '产品', title: '能做成什么产品', text: '内部管理系统、行业软件、多端服务平台与 AI 业务应用。' },
      { label: '交付', title: '怎样持续创造价值', text: '从一个可验收的试点开始，再把有效方法扩展到更多业务。' },
    ],
    takeaway: '从“展示功能”，走向“证明业务价值”。',
    sources: [{ label: '吾码平台概览', href: '/doc/' }, { label: '公开成功案例', href: '/case/case-index.html' }],
  },
  {
    id: 'enterprise-business-value', chapter: '02', kind: 'enterprise', layout: 'cards', nav: '企业为什么需要',
    title: '老板要的，是业务能跑起来',
    summary: '把散落的表格、审批、数据和岗位任务，组织成可管理、可追踪、可改进的业务系统。',
    eyebrow: '从经营问题出发',
    lead: '选平台，先看它能不能改善工作的组织方式。',
    cards: [
      { label: '看得见', title: '经营有依据', text: '客户、订单、进度与异常有统一入口，少靠反复问人和拼表。' },
      { label: '转得动', title: '协同有闭环', text: '提交、审批、办理、通知和结果都有负责人，工作不止停在聊天里。' },
      { label: '连得上', title: '数据可复用', text: '连接现有系统与数据库，让已积累的信息继续发挥价值。' },
      { label: '算得清', title: '投入可评估', text: '先记录时间、质量、完成率和运行费用，再判断是否值得扩大使用。' },
    ],
    takeaway: '把“系统上线”变成“有人使用、流程完成、结果可核查”。',
    sources: [{ label: '表单与业务建模', href: '/doc/form-engine/form-engine-info.html' }, { label: 'AI 数据分析', href: '/doc/system-engine/ai-data-analysis.html' }],
  },
  {
    id: 'enterprise-product-map', chapter: '03', kind: 'enterprise', layout: 'cards', nav: '能做什么产品',
    title: '从企业管理，到可销售的行业产品',
    summary: '吾码可作为 ERP、CRM、SRM、OA、工程项目、园区物联与多端平台的业务开发底座。',
    eyebrow: '产品方向 · 按企业需求组合',
    lead: '既能服务自己的企业，也能形成面向客户的行业软件。',
    cards: [
      { label: '制造', title: 'ERP / 生产协同', text: '订单、生产、物料、质量与工厂协作。' },
      { label: '商贸 / 供应链', title: 'CRM / SRM / 进销存', text: '客户、供应商、采购、销售与库存协同。' },
      { label: '组织管理', title: 'OA / 人事 / 资产', text: '审批、考勤、组织事务与资产管理。' },
      { label: '工程 / 项目', title: '项目经营与交付', text: '项目台账、任务进度、合同与费用流程。' },
      { label: '园区 / 物联', title: '设备与服务运营', text: '设备数据、巡检工单与公共服务入口。' },
      { label: '对外服务', title: '多端业务平台', text: 'PC、H5、小程序与 App 面向员工和客户。' },
    ],
    takeaway: '产品方向按项目建模与扩展；接下来用公开案例看实际落地。',
    sources: [{ label: '平台能力概览', href: '/doc/' }, { label: '行业案例目录', href: '/case/case-index.html' }],
  },
  {
    id: 'enterprise-garment-case', chapter: '04', kind: 'enterprise', layout: 'case', nav: '案例 · 服装 ERP',
    title: '服装生产 ERP：把行业规则做成产品',
    summary: '公开案例展示订单管理、生产管理、裁床分包、菲票明细与移动端，说明行业软件可以承接复杂业务规则。',
    eyebrow: '公开成功案例 · 制造业',
    lead: '服装工厂的核心难点，是把尺码、生产与裁床分包等行业规则真正跑通。',
    cards: [
      { title: '订单与生产有共同入口', text: '官网原图展示订单、生产、数据统计与移动端页面。' },
      { title: '复杂行业逻辑能落地', text: '案例实现动态尺码，以及裁床配比、分包和菲票明细生成。' },
      { title: '客户团队可以掌握产品', text: '由客户研发团队开发，吾码官方团队提供技术支持。' },
    ],
    image: {
      src: '/images/enterprise-training/garment-erp-production.png',
      alt: '公开服装 ERP 案例的生产管理界面', caption: '官网案例原图 · 服装 ERP 生产管理',
    },
    takeaway: '行业差异留在业务规则里，通用能力由平台复用。',
    sources: [{ label: '服装生产 ERP 原始案例', href: '/case/erp/erp-case1.html' }],
  },
  {
    id: 'enterprise-group-case', chapter: '05', kind: 'enterprise', layout: 'case', nav: '案例 · 集团协同',
    title: '集团协同：把跨部门、跨系统的工作连起来',
    summary: '集团制造协同与国企 OA 两个公开案例，展示系统连接、飞书协同与移动审批。',
    eyebrow: '公开成功案例 · 集团与国企',
    lead: '企业越大，越需要让已有系统、组织流程和一线办理协同起来。',
    metrics: [{ value: '11', label: '第三方系统数据库', note: '集团制造协同公开案例口径' }],
    cards: [
      { label: '集团制造协同', title: '连接已有系统', text: 'A 股上市公司案例扩展连接集团内部 11 个第三方系统数据库。' },
      { label: '集团制造协同', title: '进入日常协作入口', text: '对接飞书，处理流程与消息通知；支持跨库统计业务报表。' },
      { label: '集团 / 国企 OA', title: '审批进入移动场景', text: '公开案例配套小程序流程审批与多考勤点打卡。' },
    ],
    image: {
      src: '/images/enterprise-training/group-manufacturing-collaboration.png',
      alt: '公开集团制造协同系统界面', caption: '官网案例原图 · 集团制造协同',
    },
    takeaway: '保留已有投入，把新的协同能力接进企业的真实工作。',
    sources: [{ label: '集团制造协同案例', href: '/case/ims/ims-case1.html' }, { label: '集团 / 国企 OA 案例', href: '/case/oa/os-case1.html' }],
  },
  {
    id: 'enterprise-service-case', chapter: '06', kind: 'enterprise', layout: 'case', nav: '案例 · 客户服务',
    title: '从 CRM 到房产平台，服务员工与客户',
    summary: '标准 CRM 与互联网房地产两个公开案例，展示企业管理、多端客户服务和行业化产品体验。',
    eyebrow: '公开成功案例 · 商业与服务',
    lead: '一个平台，既能支撑内部业务，也能打造客户直接使用的产品。',
    cards: [
      { label: '标准 CRM', title: '管理走向移动端', text: '公开案例配套 PC 与 H5 移动端，PC 配置可同步生效。' },
      { label: '互联网房地产', title: '行业体验可以定制', text: '案例提供地图、地铁与画圈找房，并接入隐私号与 VR 设备。' },
      { label: '互联网房地产', title: '同一业务进入多个端', text: '已展示官网、管理平台、iOS、Android、小程序与 H5。' },
    ],
    image: {
      src: '/images/enterprise-training/real-estate-service-platform.png',
      alt: '公开互联网房地产案例的 PC 官网界面', caption: '官网案例原图 · 房地产服务平台',
    },
    takeaway: '不同岗位、不同用户、不同终端，围绕同一项业务协作。',
    sources: [{ label: '标准 CRM 案例', href: '/case/crm/crm-case1.html' }, { label: '互联网房地产案例', href: '/case/internet/hourse.html' }],
  },
  {
    id: 'enterprise-ai-loop', chapter: '07', kind: 'enterprise', layout: 'flow', nav: 'AI 进入业务',
    title: 'AI 的价值，在一条完整业务链里',
    summary: '用客户跟进设计示例，讲清楚提问、事实、建议、人工确认与结果复盘如何形成闭环。',
    eyebrow: '业务设计示例 · 客户跟进',
    lead: '销售负责人问：“哪些客户需要优先跟进？”答案应能继续变成可执行的工作。',
    steps: ['按当前角色提问', '查询有权访问的数据与知识', '生成建议与待办草稿', '负责人确认后办理', '记录结果并复盘效果'],
    cards: [
      { title: '让回答有事实依据', text: '现有 AI 数据分析可查询当前业务数据，解释指标、异常与建议。' },
      { title: '让行动受人和流程约束', text: '待办写入、业务办理与通知按项目配置，重要动作保留授权与人工确认。' },
      { title: '让结果可以持续改进', text: '同时核查回答是否准确、任务是否完成，以及投入是否值得。' },
    ],
    takeaway: '先证明 AI 帮助完成了哪件事，再讨论用了多少工具。',
    sources: [{ label: 'AI 数据分析', href: '/doc/system-engine/ai-data-analysis.html' }, { label: '流程与业务编排', href: '/doc/system-engine/ai-workflow-suite.html' }],
  },
  {
    id: 'enterprise-advantages', chapter: '08', kind: 'enterprise', layout: 'cards', nav: '吾码关键优势',
    title: '通用能力已备好，差异留给业务',
    summary: '以成熟业务能力、多端协作、集成扩展与可控交付，降低企业反复搭建底座的负担。',
    eyebrow: '为什么选择 Microi吾码',
    lead: 'AI 帮助更快构建，企业底座帮助产品长久运行。',
    cards: [
      { label: '更快启动', title: '减少重复建设', text: '表单、权限、审批、报表、文件与通知等通用能力可以复用。' },
      { label: '适应业务', title: '承接复杂与变化', text: '从配置到定制页面、业务规则与系统集成，按需求逐步扩展。' },
      { label: '便于协同', title: '员工与客户全端办理', text: 'PC、H5、小程序与 App 复用平台能力，按场景设计不同入口。' },
      { label: '自主可控', title: '部署与授权可选择', text: '支持自建部署与 SaaS 使用；开源底座、企业增强和服务权益按版本确认。' },
    ],
    takeaway: '比较的是整个产品生命周期的投入，而不只是第一次演示的速度。',
    sources: [{ label: '平台能力概览', href: '/doc/' }, { label: '版本与授权说明', href: '/doc/edition-comparison.html' }, { label: '自建部署', href: '/doc/getting-started/docker-run.html' }],
  },
  {
    id: 'enterprise-agent-delivery', chapter: '09', kind: 'enterprise', layout: 'cards', nav: 'Agent 交付经验',
    title: '2026：从“会搭 Agent”走向“会交付业务”',
    summary: '把 Agent 项目经验翻译成企业选型原则：先明确业务流程，再补齐公司知识，最后验证实际完成效果。',
    eyebrow: '项目经验 · 企业购买的是结果',
    lead: '企业为具体问题买单：知识查询、客服处理、销售辅助、经营分析与研发提效。',
    cards: [
      { label: '先选问题', title: '聚焦一个业务目标', text: '先拆清谁做、输入什么、怎样完成、异常归谁；工具数量不是交付目标。' },
      { label: '先找准知识', title: 'RAG 是基础能力之一', text: '让 AI 找到正确的公司文档、规则与历史记录；检索不稳，后续行动也会偏。' },
      { label: '再完成任务', title: '框架熟练不等于产品可用', text: '会搭流程只是起点，能把能力接进真实业务并持续维护才有长期价值。' },
    ],
    takeaway: '模型、知识检索与 Agent 都是组件；稳定业务应用才是交付成果。',
    sources: [{ label: '知识与 AI 能力', href: '/doc/system-engine/ai-engine.html' }, { label: '业务蓝图与流程', href: '/doc/system-engine/ai-workflow-suite.html' }],
  },
  {
    id: 'enterprise-agent-reliability', chapter: '10', kind: 'enterprise', layout: 'cards', nav: '可靠交付基本功',
    title: '真正值钱的，是出问题时也能把工作接住',
    summary: '工具失败、任务中断、上下文过长与模型输出不稳定，都需要明确的恢复、校验和人工接管设计。',
    eyebrow: '项目经验 · 从演示到日常使用',
    lead: 'AI 应用同样需要正常软件系统的可靠性与管理能力。',
    cards: [
      { label: '可恢复', title: '失败有兜底', text: '工具调用失败要有替代办法；任务中断要能恢复，并防止重复办理。' },
      { label: '可接管', title: '结果先校验', text: '长上下文要管理，输出要检查；不确定或重要事项转人工处理。' },
      { label: '可治理', title: '运行有责任边界', text: '明确部署与数据隔离，管理权限、日志、监控、模型成本与数据安全。' },
      { label: '可维护', title: '复杂度循序增加', text: 'MCP、多 Agent 值得学；先把知识检索、工具调用和异常处理做稳。' },
    ],
    takeaway: '传统软件工程经验仍然重要；可靠性需要项目设计、测试与运行验证。',
    sources: [{ label: 'AI 平台治理', href: '/doc/system-engine/ai-platform-governance.html' }, { label: 'MCP 受控交付', href: '/doc/v8-engine/mcp-server.html' }],
  },
  {
    id: 'enterprise-pilot-evaluation', chapter: '11', kind: 'enterprise', layout: 'flow', nav: '试点与验收',
    title: '先用一条业务链，证明效果与成本',
    summary: '用固定样本和业务基线评估知识检索、任务完成、工具成功、异常恢复、延迟与费用，再决定扩展。',
    eyebrow: '验收方法 · 指标先约定',
    lead: '不能只改提示词、试几个问题，再凭“感觉更好了”上线。',
    steps: ['记录当前人工处理基线', '选择固定样本与真实场景', '小范围运行并收集问题', '达到约定标准后扩展'],
    cards: [
      { label: '知识', title: '找得准、答得对', text: '检索命中与答案正确性；能否说明依据，是否越权。' },
      { label: '业务', title: '任务真正完成', text: '任务完成率、工具成功率；中断和失败后的恢复结果。' },
      { label: '体验 / 费用', title: '速度与投入可接受', text: '响应时间、Token 与运行成本，结合节省的人工时间评估。' },
      { label: '持续改进', title: '问题有归属', text: '记录错误样例（Bad Case）、人工接管与复测结果，明确负责人。' },
    ],
    takeaway: '用同一组样本做前后比较，让优化有证据、扩大投入有依据。',
    sources: [{ label: 'AI 分析事实与权限边界', href: '/doc/system-engine/ai-data-analysis.html' }, { label: '运行治理与可观测', href: '/doc/system-engine/ai-platform-governance.html' }],
  },
  {
    id: 'enterprise-next-step', chapter: '12', kind: 'enterprise', layout: 'closing', nav: '决策与下一步',
    title: '从一个值得落地的产品开始',
    summary: '由业务负责人、真实数据、部署授权与验收标准共同确定试点，再决定如何扩大使用。',
    eyebrow: '下一步 · 一起把业务做成产品',
    lead: '先选一个有负责人、有真实需求、有衡量标准的场景。',
    cards: [
      { label: '业务', title: '谁来用，解决什么', text: '选定业务负责人，梳理现状、关键流程与首批用户。' },
      { label: '边界', title: '在哪里跑，谁能看', text: '确定部署、数据来源、权限范围与所需授权。' },
      { label: '结果', title: '怎样算成功', text: '共同约定范围、交付物、验收指标、预算与运维责任。' },
    ],
    steps: ['明确业务与现状', '确定试点范围', '验证效果与成本', '决定推广与产品化'],
    takeaway: '把 AI 的速度，变成企业可持续的交付力。',
    sources: [{ label: '开始使用吾码', href: '/doc/getting-started/start-use.html' }, { label: '版本与授权说明', href: '/doc/edition-comparison.html' }, { label: '查看更多成功案例', href: '/case/case-index.html' }],
  },
]

// 保持所有页面键一致，避免 Vue 模板按布局推导出互不兼容的可选联合类型。
export const enterpriseSlides = enterpriseSlideDefinitions.map(slide => ({
  ...slide,
  lead: slide.lead || '',
  cards: slide.cards || [],
  steps: slide.steps || [],
  metrics: slide.metrics || [],
  takeaway: slide.takeaway || '',
  sources: slide.sources || [],
  image: slide.image || null,
}))

export const enterpriseSlideCount = 12
if (enterpriseSlides.length !== enterpriseSlideCount) throw new Error('企业应用版 PPT 必须包含 12 页')

export const enterpriseSections = [
  { id: 'enterprise-value', title: '价值与产品', slideIds: ['enterprise-opening', 'enterprise-business-value', 'enterprise-product-map'] },
  { id: 'enterprise-cases', title: '真实行业案例', slideIds: ['enterprise-garment-case', 'enterprise-group-case', 'enterprise-service-case'] },
  { id: 'enterprise-delivery', title: 'AI 与交付优势', slideIds: ['enterprise-ai-loop', 'enterprise-advantages', 'enterprise-agent-delivery', 'enterprise-agent-reliability'] },
  { id: 'enterprise-action', title: '验收与决策', slideIds: ['enterprise-pilot-evaluation', 'enterprise-next-step'] },
]
