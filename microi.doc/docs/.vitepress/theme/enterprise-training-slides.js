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
    title: '让企业的想法，成为可用的产品',
    summary: 'Microi吾码 · AI 驱动的企业应用平台',
    eyebrow: '企业应用版 · 面向客户、领导与经营者',
    cards: [
      { title: '能做什么', text: '企业系统、行业软件与 AI 应用。' },
      { title: '为什么选择', text: '复用成熟能力，专注业务差异。' },
      { title: '怎样证明', text: '从可验收的试点开始。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-01-ui.png', alt: 'AI 生成的 Microi吾码企业工作台界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 企业工作台' },
    sources: [{ label: '平台概览', href: '/doc/' }, { label: '公开案例', href: '/case/case-index.html' }],
  },
  {
    id: 'enterprise-business-value', chapter: '02', kind: 'enterprise', layout: 'cards', nav: '企业为什么需要',
    title: '老板要的，是业务跑起来',
    summary: '让信息可见、协同有序、投入可衡量。',
    eyebrow: '从经营问题出发',
    cards: [
      { title: '看得见', text: '客户、订单、进度与异常。' },
      { title: '转得动', text: '岗位、审批、办理与结果闭环。' },
      { title: '算得清', text: '效率、质量与运行成本。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-02-ui.png', alt: 'AI 生成的经营驾驶舱界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 经营驾驶舱' },
    sources: [{ label: '业务建模', href: '/doc/form-engine/form-engine-info.html' }, { label: 'AI 数据分析', href: '/doc/system-engine/ai-data-analysis.html' }],
  },
  {
    id: 'enterprise-product-map', chapter: '03', kind: 'enterprise', layout: 'cards', nav: '能做什么产品',
    title: '一个底座，做出多种产品',
    summary: '按真实业务需求组合与扩展。',
    eyebrow: '产品方向 · 从内部管理到对外服务',
    cards: [
      { title: '企业管理', text: 'ERP、CRM、SRM、OA、进销存。' },
      { title: '行业软件', text: '制造、工程项目、园区与供应链。' },
      { title: '多端服务', text: 'PC、H5、小程序与 App。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-03-ui.png', alt: 'AI 生成的 ERP、CRM 与 OA 多产品界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 企业产品组合' },
    sources: [{ label: '平台能力', href: '/doc/' }, { label: '行业案例目录', href: '/case/case-index.html' }],
  },
  {
    id: 'enterprise-garment-case', chapter: '04', kind: 'enterprise', layout: 'case', nav: '案例 · 服装 ERP',
    title: '服装 ERP：让行业规则落地',
    summary: '客户研发团队开发，吾码官方支持。',
    eyebrow: '公开成功案例 · 制造业',
    cards: [
      { title: '订单与生产协同', text: '' },
      { title: '动态尺码与裁床分包', text: '' },
      { title: '菲票明细与移动端', text: '' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-04-ui.png', alt: 'AI 生成的服装 ERP 与移动菲票界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 服装 ERP' },
    sources: [{ label: '服装 ERP 原始案例', href: '/case/erp/erp-case1.html' }],
  },
  {
    id: 'enterprise-group-case', chapter: '05', kind: 'enterprise', layout: 'case', nav: '案例 · 集团协同',
    title: '集团协同：连接已有投入',
    summary: 'A 股公司制造协同与国企 OA 公开案例。',
    eyebrow: '公开成功案例 · 集团与国企',
    metrics: [{ value: '11', label: '第三方系统数据库', note: '集团制造协同案例' }],
    cards: [
      { title: '飞书协同与跨库报表', text: '' },
      { title: '国企 OA 移动审批', text: '' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-05-ui.png', alt: 'AI 生成的集团跨系统协同与 OA 审批界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 集团协同' },
    sources: [{ label: '集团制造协同', href: '/case/ims/ims-case1.html' }, { label: '集团 / 国企 OA', href: '/case/oa/os-case1.html' }],
  },
  {
    id: 'enterprise-service-case', chapter: '06', kind: 'enterprise', layout: 'case', nav: '案例 · 客户服务',
    title: '让产品直接服务客户',
    summary: '标准 CRM 与房地产服务平台公开案例。',
    eyebrow: '公开成功案例 · 商业与服务',
    cards: [
      { title: 'CRM 配置同步 PC 与 H5', text: '' },
      { title: '地图找房、隐私号与 VR', text: '' },
      { title: '官网、App、小程序多端服务', text: '' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-06-ui.png', alt: 'AI 生成的 CRM 客户跟进与房源服务界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · CRM 与房产' },
    sources: [{ label: '标准 CRM', href: '/case/crm/crm-case1.html' }, { label: '房地产服务平台', href: '/case/internet/hourse.html' }],
  },
  {
    id: 'enterprise-ai-loop', chapter: '07', kind: 'enterprise', layout: 'flow', nav: 'AI 进入业务',
    title: '让 AI 回答，变成业务结果',
    summary: '设计示例：哪些客户需要优先跟进？',
    eyebrow: '业务设计示例 · 客户跟进',
    cards: [
      { title: '查到有权访问的事实', text: '' },
      { title: '生成建议与待办草稿', text: '' },
      { title: '人工确认后办理，记录结果', text: '' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-07-ui.png', alt: 'AI 生成的客户跟进 Agent 业务闭环界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 业务 Agent' },
    sources: [{ label: '现有 AI 数据分析', href: '/doc/system-engine/ai-data-analysis.html' }, { label: '按项目编排流程', href: '/doc/system-engine/ai-workflow-suite.html' }],
  },
  {
    id: 'enterprise-advantages', chapter: '08', kind: 'enterprise', layout: 'cards', nav: '吾码关键优势',
    title: '通用能力复用，业务持续生长',
    summary: '把重复建设的时间，留给产品差异。',
    eyebrow: '为什么选择 · 吾码关键优势',
    cards: [
      { title: '成熟能力', text: '表单、权限、审批、报表与通知。' },
      { title: '灵活扩展', text: '复杂规则、定制页面与系统集成。' },
      { title: '交付可控', text: '多端协作，自建 / SaaS 按版本选择。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-08-ui.png', alt: 'AI 生成的吾码表单搭建与多端预览界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 平台搭建' },
    sources: [{ label: '平台能力', href: '/doc/' }, { label: '版本与授权', href: '/doc/edition-comparison.html' }, { label: '自建部署', href: '/doc/getting-started/docker-run.html' }],
  },
  {
    id: 'enterprise-agent-delivery', chapter: '09', kind: 'enterprise', layout: 'cards', nav: 'Agent 交付经验',
    title: '2026：从会搭 Agent，到会交付',
    summary: '企业为具体问题买单。',
    eyebrow: '项目经验 · 企业购买的是结果',
    cards: [
      { title: '拆清业务流程', text: '聚焦知识查询、客服、销售与分析。' },
      { title: '找准公司知识', text: 'RAG 是基础，检索不稳就会偏。' },
      { title: '框架熟练不等于交付', text: '会搭流程只是起点。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-09-ui.png', alt: 'AI 生成的公司知识库与 RAG 引用问答界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 知识与 RAG' },
    sources: [{ label: '公司知识与 AI 能力', href: '/doc/system-engine/ai-engine.html' }, { label: '业务蓝图与流程', href: '/doc/system-engine/ai-workflow-suite.html' }],
  },
  {
    id: 'enterprise-agent-reliability', chapter: '10', kind: 'enterprise', layout: 'cards', nav: 'AI 像软件一样交付',
    title: '可靠的 AI，能把工作接住',
    summary: 'MCP、多 Agent 先练基本功。',
    eyebrow: '项目经验 · 可靠交付基本功',
    cards: [
      { title: '失败兜底，任务恢复', text: '工具调用与长上下文可控。' },
      { title: '输出校验，人工接管', text: '' },
      { title: '部署与数据隔离', text: '权限、日志、监控、成本、数据安全。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-10-ui.png', alt: 'AI 生成的任务恢复与人工接管运行界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 可靠交付' },
    sources: [{ label: 'AI 平台治理', href: '/doc/system-engine/ai-platform-governance.html' }, { label: 'MCP 受控交付', href: '/doc/v8-engine/mcp-server.html' }],
  },
  {
    id: 'enterprise-pilot-evaluation', chapter: '11', kind: 'enterprise', layout: 'flow', nav: '试点与验收',
    title: '效果与成本，用证据说话',
    summary: '用固定样本，对比人工处理基线。',
    eyebrow: '验收方法 · 指标先约定',
    cards: [
      { title: '知识准确', text: '检索准确率与答案依据。' },
      { title: '任务完成率', text: '工具成功率与异常恢复。' },
      { title: '投入可衡量', text: '延迟、Token、人工时间与 Bad Case。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-11-ui.png', alt: 'AI 生成的效果、质量与成本评估界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 评估与成本' },
    sources: [{ label: 'AI 分析与权限', href: '/doc/system-engine/ai-data-analysis.html' }, { label: '运行治理', href: '/doc/system-engine/ai-platform-governance.html' }],
  },
  {
    id: 'enterprise-next-step', chapter: '12', kind: 'enterprise', layout: 'closing', nav: '决策与下一步',
    title: '从一个值得落地的产品开始',
    summary: '把 AI 的速度，变成企业的交付力。',
    eyebrow: '下一步 · 一起把业务做成产品',
    cards: [
      { title: '选场景', text: '业务负责人、首批用户与流程。' },
      { title: '定边界', text: '数据、权限、部署与授权。' },
      { title: '验结果', text: '效果、成本与运维责任。' },
    ],
    image: { src: '/images/enterprise-training/ai/slide-12-ui.png', alt: 'AI 生成的试点实施与验收看板界面概念图，非真实系统或客户截图', caption: 'AI 界面概念图 · 试点实施' },
    sources: [{ label: '开始使用', href: '/doc/getting-started/start-use.html' }, { label: '版本与授权', href: '/doc/edition-comparison.html' }, { label: '更多成功案例', href: '/case/case-index.html' }],
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
