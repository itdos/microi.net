<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { searchTrainingSlides } from '../training-syllabus-search.js'

type DeckPanel = '' | 'help'
type SlideKind = 'cover' | 'decision' | 'why' | 'start' | 'atlas' | 'mcp' | 'engine' | 'multi-end' | 'cases' | 'closing'
type EngineDomain = 'build' | 'experience' | 'intelligence' | 'integration'

interface EngineHighlight {
  title: string
  text: string
}

interface AtlasEntry {
  id: string
  nav: string
  href: string
}

interface EngineSlide extends AtlasEntry {
  domain: EngineDomain
  title: string
  summary: string
  code: string
  glyph: string
  accent: string
  promise: string
  orbit: readonly string[]
  highlights: readonly EngineHighlight[]
  demo: readonly string[]
  linkLabel: string
}

interface SlideMeta {
  id: string
  chapter: string
  kind: SlideKind
  nav: string
  title: string
  summary: string
  engine?: EngineSlide
}

interface AtlasGroup {
  code: string
  title: string
  entryIds: readonly string[]
}

interface WhyAdvantage {
  no: string
  code: string
  title: string
  proof: string
  side: 'left' | 'right'
}

// 第 03 页只引用本课件后续章节可展开、可演示、可验收的能力，避免把品牌主张写成空泛口号。
const whyDeliveryStages = ['AI 对话建模', '自动实现', '全自动测试', '受控发布', '运行治理'] as const

const whyTrustSignals = ['开源可控', 'SaaS 多租户', '多数据库', '全端统一'] as const

const whyAdvantages: WhyAdvantage[] = [
  {
    no: '01', code: 'AI NATIVE', title: '零代码 AI 对话',
    proof: '一句话生成大型企业应用', side: 'left',
  },
  {
    no: '02', code: 'CROSS PLATFORM', title: '跨平台全端',
    proof: 'PC · H5 · 小程序 · App · Unity', side: 'left',
  },
  {
    no: '03', code: 'PERFORMANCE', title: '高性能底座',
    proof: '.NET 10 · Vue 3 · Redis · L1 + L2', side: 'left',
  },
  {
    no: '04', code: 'DISTRIBUTED', title: '分布式原生',
    proof: '多节点 · MQ · 任务 · 幂等', side: 'left',
  },
  {
    no: '05', code: 'COMPOSABLE', title: '插件化引擎',
    proof: '30+ 引擎 · 应用商城', side: 'right',
  },
  {
    no: '06', code: 'MICROSERVICE', title: '微服务扩展',
    proof: '低代码 · V8 · 微服务 · 源码', side: 'right',
  },
  {
    no: '07', code: 'VERIFIED', title: '全自动化测试',
    proof: '规划 · 预演 · 测试 · 构建 · 回读', side: 'right',
  },
  {
    no: '08', code: 'GOVERNED', title: '企业级治理',
    proof: '权限 · SSO · 审计 · AI 治理', side: 'right',
  },
]

const whyAdvantagesOn = (side: WhyAdvantage['side']) => whyAdvantages.filter(item => item.side === side)

const pdfDownloadPaths = {
  dark: '/downloads/microi-ai-development-framework-training-syllabus-dark.pdf',
  light: '/downloads/microi-ai-development-framework-training-syllabus-light.pdf',
} as const

const engineSlides: EngineSlide[] = [
  {
    id: 'form-engine', domain: 'build', nav: '表单引擎', title: '万物皆表单：从数据模型到业务界面',
    summary: '一张业务表，联动字段、表单、列表、权限、事件与多端呈现。', code: 'FORM', glyph: '▦', accent: '#ff5a67',
    promise: '把“建表”直接推进到“可用业务模块”。', orbit: ['40+ 控件', '主子表', 'V8 事件', '多端表单'],
    highlights: [
      { title: '模型即应用', text: '字段、校验、布局、关联和展示规则共享同一份元数据。' },
      { title: '完整事件链', text: '初始化、提交前后、数据过滤与关闭回调覆盖业务生命周期。' },
      { title: '一表多视图', text: '按角色复用为列表、卡片、详情、流程入口与移动表单。' },
    ],
    demo: ['创建业务表', '配置字段与布局', '生成列表和表单', '验证事件与权限'],
    href: '/doc/form-engine/form-engine-info.html', linkLabel: '打开表单引擎文档',
  },
  {
    id: 'module-engine', domain: 'build', nav: '模块引擎', title: '把数据组织成真正可工作的业务入口',
    summary: '菜单、列表、搜索、按钮、卡片与权限在模块中一次配置。', code: 'MODULE', glyph: '▤', accent: '#ff8f5a',
    promise: '同一张表，为不同岗位形成不同工作台。', orbit: ['菜单路由', '列表搜索', '业务按钮', '角色权限'],
    highlights: [
      { title: '多种模块形态', text: 'Diy、组件、Iframe、二级菜单与微应用按场景组合。' },
      { title: '列表即工作区', text: '列、筛选、排序、统计、卡片和批量动作集中配置。' },
      { title: '权限落到动作', text: '菜单、按钮、表、字段与数据范围形成一致授权边界。' },
    ],
    demo: ['绑定业务表', '选择列表与搜索列', '配置按钮动作', '分配角色并回读'],
    href: '/doc/system-engine/module-engine.html', linkLabel: '打开模块引擎文档',
  },
  {
    id: 'v8-engine', domain: 'build', nav: 'V8 引擎', title: '在线编程：让差异化逻辑保存即生效',
    summary: '在可信租户与身份上下文中，用 JavaScript 编排平台原子能力。', code: 'V8', glyph: '⌘', accent: '#ffbd59',
    promise: '通用能力由平台提供，业务差异留给在线脚本。', orbit: ['FormEngine', 'Db / Cache', 'HTTP / MQ', 'Office / AI'],
    highlights: [
      { title: '上下文完整', text: 'Param、CurrentUser、OsClient、DiyToken 与事务直接可用。' },
      { title: '能力面广', text: '数据、缓存、网络、文件、消息、任务、AI 与设备统一调用。' },
      { title: '事务语义清晰', text: '接口返回 Code=1 自动提交，其他结果自动回滚。' },
    ],
    demo: ['读取请求与身份', '调用 FormEngine', '组合缓存与 HTTP', '返回并观察事务'],
    href: '/doc/v8-engine/v8-server.html', linkLabel: '打开 V8 后端函数文档',
  },
  {
    id: 'api-engine', domain: 'build', nav: '接口引擎', title: '业务 API 与数据源能力，统一在线交付',
    summary: 'V8、SQL、JSON 类型化数据源与业务接口共用路由、鉴权、版本和运行边界。', code: 'API', glyph: '⇄', accent: '#f0c56a',
    promise: '从只读取数到复杂事务，都在同一接口工作台保存即生效。', orbit: ['V8 / SQL / JSON', '自定义路由', '统一鉴权', '事务编排'],
    highlights: [
      { title: '类型化数据能力', text: '原数据源引擎已并入接口引擎，SQL、JSON 与 V8 可供字段、报表和页面复用。' },
      { title: '企业级 API', text: '支持 Get/Post、Form/JSON/URL、自定义路由、文件和流式响应。' },
      { title: '可组合事务', text: '接口可调用接口，复用事务、租户与权限上下文编排复杂业务。' },
    ],
    demo: ['选择 V8 / SQL / JSON', '设置 Key 与权限', '绑定字段或报表', '执行事务并回读'],
    href: '/doc/v8-engine/api-engine.html', linkLabel: '打开接口引擎文档',
  },
  {
    id: 'page-engine', domain: 'experience', nav: '界面引擎', title: '可视化构建驾驶舱、工作台与业务大屏',
    summary: '组件、布局、数据源与交互在同一画布中组合，并保留版本能力。', code: 'PAGE', glyph: '◫', accent: '#55d8e6',
    promise: '把指标、图表、列表和动作拼成可运营页面。', orbit: ['拖拽布局', '数据绑定', '交互联动', '版本回滚'],
    highlights: [
      { title: '丰富物料', text: '文本、指标、表格、图表、地图与业务组件自由组合。' },
      { title: '真实数据', text: '数据源和平台上下文驱动页面，不止是静态原型。' },
      { title: '可演进', text: '支持版本、比较、回滚、撤销重做与 Vue 源码桥。' },
    ],
    demo: ['创建页面', '拖入组件', '绑定数据源', '发布并回滚版本'],
    href: '/doc/system-engine/page-engine.html', linkLabel: '打开界面引擎文档',
  },
  {
    id: 'template-engine', domain: 'experience', nav: '模板引擎', title: '让表格与表单按业务语义呈现',
    summary: '通过 V8 模板把原始字段转换为状态、标签、组合信息和业务视图。', code: 'TPL', glyph: '✦', accent: '#7aa2ff',
    promise: '不改数据结构，也能交付更懂业务的呈现。', orbit: ['表格模板', '表单模板', '安全渲染', '异步数据'],
    highlights: [
      { title: '按行渲染', text: '列表字段可读取当前行并输出结构化业务信息。' },
      { title: '表单联动', text: '字段变化后可同步刷新模板，形成即时反馈。' },
      { title: '边界明确', text: '净化输出、控制异步和重计算，兼顾安全与性能。' },
    ],
    demo: ['选择目标字段', '编写模板 V8', '预览联动效果', '检查移动端显示'],
    href: '/doc/form-engine/model-engine.html', linkLabel: '打开模板引擎文档',
  },
  {
    id: 'print-engine', domain: 'experience', nav: '打印引擎', title: '在线设计合同、标签、单据与小票',
    summary: '模板设计、业务数据、预览输出和设备打印形成一条链路。', code: 'PRINT', glyph: '▧', accent: '#9a8cff',
    promise: '让“打印格式”成为可配置资产，而不是散落代码。', orbit: ['在线设计', '动态数据', '预览导出', '蓝牙打印'],
    highlights: [
      { title: '业务模板', text: '合同、出库单、标签、报表和票据可视化维护。' },
      { title: '数据绑定', text: '主表、子表、图片、二维码与计算结果统一进入模板。' },
      { title: '多种输出', text: '浏览器预览、PDF/纸张与兼容设备路径按场景选择。' },
    ],
    demo: ['创建打印模板', '绑定业务字段', '预览分页效果', '选择输出设备'],
    href: '/doc/system-engine/print-engine.html', linkLabel: '打开打印引擎文档',
  },
  {
    id: 'report-engine', domain: 'experience', nav: '报表引擎', title: '查询、编辑，并联动多表多库的可写报表',
    summary: '报表表格支持增删改查；保存时可由接口引擎按业务逻辑更新多张表与多个数据库。', code: 'REPORT', glyph: '▥', accent: '#bd8cff',
    promise: '报表不是只读终点，而是可编辑、可执行业务规则的数据工作台。', orbit: ['聚合查询', '表内编辑', '多表事务', '多数据库'],
    highlights: [
      { title: '查询即可编辑', text: '聚合或多源查询结果可配置可编辑列、新增、修改与删除入口。' },
      { title: '写入业务逻辑', text: 'CRUD 分别绑定接口引擎，在服务端重新校验并联动多张业务表。' },
      { title: '跨库编排', text: '可访问已配置扩展库；跨库写入用幂等、事务与补偿保证一致性。' },
    ],
    demo: ['配置聚合查询', '开启表内编辑', '绑定 CRUD 接口', '回读多表多库结果'],
    href: '/doc/system-engine/report-engine.html', linkLabel: '打开报表引擎文档',
  },
  {
    id: 'workflow-engine', domain: 'build', nav: '流程 / 工作流引擎', title: '让审批路径、业务状态与数据事务协同',
    summary: '图形化流程、条件路由、节点动作和待办通知组成业务闭环。', code: 'WF', glyph: '⟿', accent: '#d76fff',
    promise: '流程不只“流转”，还要可靠地改变业务。', orbit: ['流程设计', '条件路由', '节点 V8', '待办审计'],
    highlights: [
      { title: '可视化拓扑', text: '节点、连线、处理人和审批动作在设计器中维护。' },
      { title: 'V8 决策', text: '按表单数据选择下一节点，并在节点前后执行业务逻辑。' },
      { title: '事务闭环', text: '审批结果、业务状态、消息和审计保持一致。' },
    ],
    demo: ['绑定业务表', '绘制节点连线', '配置条件与人员', '发起并完成审批'],
    href: '/doc/system-engine/wf-engine.html', linkLabel: '打开工作流引擎文档',
  },
  {
    id: 'saas-engine', domain: 'build', nav: 'SaaS 引擎', title: '一套程序，安全承载多个租户与网络',
    summary: 'OsClient、租户类型和网络边界贯穿数据、缓存、文件、接口与 AI。', code: 'SAAS', glyph: '⬡', accent: '#53d6ad',
    promise: '多租户不是后补功能，而是平台运行上下文。', orbit: ['OsClient', '租户配置', '隔离缓存', '独立数据库'],
    highlights: [
      { title: '三参数模型', text: 'OsClient、OsClientType、OsClientNetwork 描述租户运行环境。' },
      { title: '配置事实源', text: '数据库、Redis、文件、模型和业务开关归属当前租户。' },
      { title: '共享与隔离并存', text: '共享程序和节点，同时隔离数据、密钥、缓存与资产。' },
    ],
    demo: ['创建租户', '配置数据与缓存', '切换租户登录', '验证跨租户隔离'],
    href: '/doc/system-engine/saas-engine.html', linkLabel: '打开 SaaS 引擎文档',
  },
  {
    id: 'microservice-engine', domain: 'experience', nav: '前端微服务', title: '复杂交互继续工程化，又不离开平台能力',
    summary: '微服务页面可独立运行、菜单直开、弹层打开或嵌入表单。', code: 'MICRO', glyph: '◩', accent: '#48e7a6',
    promise: '低代码承接通用页面，微服务承接复杂体验。', orbit: ['多页路由', '私有源码', '公共产物', '四种运行'],
    highlights: [
      { title: '在线与本地协作', text: 'AI 工作台和 VS Code 都能创建、同步、调试与发布。' },
      { title: '平台上下文', text: '复用 API Base、OsClient、DiyToken、主题和路由能力。' },
      { title: '资产不进上下文', text: '大文件走独立资产链路，AI 只处理需要理解的源码。' },
    ],
    demo: ['发现已有应用', '新增页面与路由', '本地预览联调', '发布并嵌入模块'],
    href: '/doc/system-engine/micro-app.html', linkLabel: '打开前端微服务文档',
  },
  {
    id: 'microi-ui', domain: 'experience', nav: 'Microi.UI', title: '用统一设计系统保持全端体验一致',
    summary: '设计 Token、Vue 3 组件、响应式规则与无障碍约束共同复用。', code: 'UI', glyph: '◈', accent: '#44d5c4',
    promise: '让业务页面像同一个产品，而不是功能拼盘。', orbit: ['Design Token', 'Vue 3', '响应式', '无障碍'],
    highlights: [
      { title: '统一语言', text: '颜色、间距、圆角、排版、状态和交互遵循同一规则。' },
      { title: '组件复用', text: '业务组件与平台能力可在常规站点和微服务中使用。' },
      { title: '移动优先验收', text: '触控尺寸、安全区、横竖屏和降级动效纳入交付。' },
    ],
    demo: ['加载 UI Token', '组合业务组件', '切换明暗主题', '检查桌面与手机'],
    href: '/doc/system-engine/microi-ui.html', linkLabel: '打开 Microi.UI 文档',
  },
  {
    id: 'app-store', domain: 'intelligence', nav: '应用商城', title: '把系统能力打包成可升级、可复用的产品',
    summary: '表、字段、菜单、权限、接口、流程与页面通过 Manifest 统一交付。', code: 'STORE', glyph: '⬢', accent: '#62d6ad',
    promise: '交付的不只是代码，而是一套可安装、可升级的业务资产。', orbit: ['Manifest', 'Managed', 'Tenant Hook', '版本回读'],
    highlights: [
      { title: '声明式资源', text: '平台资源按依赖顺序安装，减少人工搬运和环境差异。' },
      { title: '双策略升级', text: 'Managed 维护官方事实，CreateIfMissing 保留租户扩展。' },
      { title: '证据闭环', text: '版本、内容哈希、安装结果与目标端回读分别验证。' },
    ],
    demo: ['选择应用能力', '生成 Manifest', 'Dry Run 检查', '安装升级并回读'],
    href: '/doc/system-engine/app-store.html', linkLabel: '打开应用商城文档',
  },
  {
    id: 'email-engine', domain: 'experience', nav: '邮箱系统', title: '独立运行，也能作为吾码微服务',
    summary: 'QQ、163 与自定义邮箱统一管理，支持自动 / 手动同步、收发回复转发与附件。', code: 'EMAIL', glyph: '✉', accent: '#62c9ed',
    promise: '同一套源码，从独立邮箱门户到企业业务工作台。', orbit: ['独立运行', '吾码微服务', '多邮箱收发', '完整源码'],
    highlights: [
      { title: '独立 Web 运行', text: '前端可独立部署、独立登录，连接配套吾码后端，无需打开平台工作台。' },
      { title: '吾码微服务运行', text: '通过系统引擎 /mci-email 进入，复用登录、主题与原有邮箱账号表单。' },
      { title: '完整源码与业务扩展', text: '商城提供源码，接口引擎编排收发与同步，可与客户、流程和通知集成。' },
    ],
    demo: ['选择运行方式', '接入邮箱账号', '同步收发邮件', '按业务扩展'],
    href: '/doc/system-engine/email-engine.html', linkLabel: '打开邮箱系统文档与 4K 界面',
  },
  {
    id: 'ai-engine', domain: 'intelligence', nav: 'AI 引擎', title: '把模型、知识、工具与业务数据接入开发链路',
    summary: '统一模型路由、流式对话、多模态、RAG、NL2SQL 与 NL2V8。', code: 'AI', glyph: '✺', accent: '#7ac7ff',
    promise: 'AI 不做外挂聊天框，而是进入设计、开发和运行。', orbit: ['模型网关', 'RAG', 'NL2SQL', 'Tool Calling'],
    highlights: [
      { title: '模型可治理', text: '多供应商路由、密钥隔离、配额和调用记录统一管理。' },
      { title: '数据可理解', text: 'Schema 检索、知识库和业务上下文共同支撑准确回答。' },
      { title: '能力可编排', text: '外部 Agent 经 MCP，或平台工作流经受控接口编排模型与 V8 能力。' },
    ],
    demo: ['配置模型路由', '接入知识与 Schema', '调用工具完成任务', '查看用量与结果'],
    href: '/doc/system-engine/ai-engine.html', linkLabel: '打开 AI 引擎文档',
  },
  {
    id: 'ai-data-analysis', domain: 'intelligence', nav: 'AI 数据分析', title: '用自然语言，把业务数据变成可执行经营结论',
    summary: '权限感知 Schema、NL2SQL、实时查询、指标解读和连续追问形成一条安全分析链。', code: 'DATA', glyph: '▥', accent: '#42d6d0',
    promise: '业务人员不写 SQL，也能在权限范围内追问客户、合同、跟进、售后与设备数据。', orbit: ['自然语言', '权限 Schema', 'NL2SQL', '经营洞察'],
    highlights: [
      { title: '当前数据', text: '业务事实在请求发生时从当前租户数据库查询，不把明细预复制到向量库。' },
      { title: '权限先行', text: '候选表、SQL 校验和执行结果都受当前用户、角色和租户边界约束。' },
      { title: '结论可追问', text: '先给核心结论，再围绕口径、异常、人员与改进动作持续下钻。' },
    ],
    demo: ['询问本月经营概览', '核对 SQL 与指标口径', '追问销售活跃度', '验证角色数据边界'],
    href: '/doc/system-engine/ai-data-analysis.html', linkLabel: '打开 AI 数据分析培训页',
  },
  {
    id: 'ai-creative-studio', domain: 'intelligence', nav: 'AI 创作中心', title: '从一个想法，完成图片、视频、声音与音乐创作',
    summary: '统一入口覆盖视觉生成、AI 编辑、人像商品、精确处理、视频任务和音乐试听。', code: 'MEDIA', glyph: '✦', accent: '#f0b95f',
    promise: '从灵感、参考图到可预览、可下载、可归档的真实媒体结果，在一个工作台完成。', orbit: ['AI 图片', 'AI 视频', 'AI 音乐', '29 项工具'],
    highlights: [
      { title: '视觉全链路', text: '文生图、图生图、重绘、扩图、去水印、人像与商品素材完整覆盖。' },
      { title: '视频与声音', text: '支持文生/图生视频，以及纯音乐生成、原页试听和下载。' },
      { title: '生成与精确分轨', text: 'AI 重构画面；裁剪、旋转、格式转换等确定性操作由 V8.Image 执行。' },
    ],
    demo: ['从文字生成主视觉', '用参考图重绘与扩图', '创建视频与纯音乐', '预览并归档到 HDFS'],
    href: '/doc/system-engine/ai-creative-studio.html', linkLabel: '打开 AI 创作中心培训页',
  },
  {
    id: 'ai-workflow-suite', domain: 'intelligence', nav: 'AI 工作流', title: '从业务蓝图到状态机与智能流程',
    summary: 'AI 工作流、业务蓝图、状态机、自动化流和流程挖掘相互衔接。', code: 'FLOW', glyph: '⤳', accent: '#9a8cff',
    promise: '先把系统结构讲清楚，再让 AI 稳定地产生变更。', orbit: ['业务蓝图', 'AI 工作流', '状态机', '流程挖掘'],
    highlights: [
      { title: '设计期知识图谱', text: '角色、实体、流程、状态和系统边界形成共同语言。' },
      { title: '运行期有界编排', text: '模型、工具、数据与人工节点按明确输入输出协同。' },
      { title: '持续优化', text: '从真实流程记录发现瓶颈，再回到蓝图和自动化改进。' },
    ],
    demo: ['绘制业务蓝图', '定义状态与动作', '编排 AI 工具节点', '用记录验证流程'],
    href: '/doc/system-engine/ai-workflow-suite.html', linkLabel: '打开 AI 工作流套件文档',
  },
  {
    id: 'ai-governance', domain: 'intelligence', nav: 'AI 平台治理', title: '让 AI 能力可用、可控、可计量、可审计',
    summary: '模型、账号、应用、配额、密钥、日志与成本进入统一治理面。', code: 'GOV', glyph: '◎', accent: '#bd8cff',
    promise: '企业 AI 从“能调用”走向“能长期运营”。', orbit: ['模型目录', '配额成本', '应用门户', '调用审计'],
    highlights: [
      { title: '资源统一', text: '供应商、模型、知识、工具和应用形成可发现能力目录。' },
      { title: '策略统一', text: '按租户、用户、应用设置路由、配额与数据边界。' },
      { title: '观测统一', text: '调用链、Token、延迟、错误和成本支持追踪与分析。' },
    ],
    demo: ['登记模型资源', '分配租户策略', '发布 AI 应用', '检查用量与审计'],
    href: '/doc/system-engine/ai-platform-governance.html', linkLabel: '打开 AI 平台治理文档',
  },
  {
    id: 'cache-engine', domain: 'integration', nav: '缓存引擎', title: 'L1 + L2 多级缓存，兼顾极速与分布式一致性',
    summary: 'L1 进程内热点缓存降低延迟，L2 租户 Redis 跨节点共享，并通过 Pub/Sub 主动失效。', code: 'CACHE', glyph: '≋', accent: '#52d6a8',
    promise: '热点先命中 L1，跨节点共享 L2；性能提升不牺牲租户隔离。', orbit: ['L1 内存', 'L2 Redis', 'Pub/Sub 失效', 'TTL 兜底'],
    highlights: [
      { title: '两级读取链路', text: 'L1 命中直接返回；未命中再读 L2 Redis，并回填当前节点 L1。' },
      { title: '跨节点主动失效', text: 'Redis 写入成功后更新本节点，并广播清理其它节点旧 L1。' },
      { title: '租户级可运维', text: 'OsClient 隔离、TTL、Hash 原子操作、SCAN 与受控管理完整覆盖。' },
    ],
    demo: ['观察 L1 / L2 命中', '更新并广播失效', '验证 TTL 兜底', '用管理器安全回读'],
    href: '/doc/system-engine/cache.html', linkLabel: '打开缓存引擎文档',
  },
  {
    id: 'search-engine', domain: 'integration', nav: '搜索引擎', title: '让企业数据拥有可治理的全文检索',
    summary: '索引、同步、查询、权限与租户隔离围绕 Elasticsearch 形成闭环。', code: 'SEARCH', glyph: '⌕', accent: '#4de8ff',
    promise: '在海量业务数据中快速找到“有权看到”的结果。', orbit: ['索引配置', '增量同步', '全文检索', '权限过滤'],
    highlights: [
      { title: '索引可配置', text: '选择业务表、字段和分词策略，建立面向场景的索引。' },
      { title: '同步可追踪', text: '全量与增量更新有状态、错误和恢复边界。' },
      { title: '查询有权限', text: '租户、用户和数据范围继续约束搜索结果。' },
    ],
    demo: ['创建索引', '执行首轮同步', '搜索业务关键词', '验证权限与更新'],
    href: '/doc/system-engine/search-engine.html', linkLabel: '打开搜索引擎文档',
  },
  {
    id: 'spider-engine', domain: 'integration', nav: '采集引擎', title: '把网页与外部内容转成可管理的数据源',
    summary: 'HTTP 与浏览器采集、解析、任务、资源预算和结果入库统一编排。', code: 'SPIDER', glyph: '⌗', accent: '#45d0ee',
    promise: '采集不是一次脚本，而是一条可运行、可观察的数据管道。', orbit: ['HTTP 采集', '浏览器采集', '内容解析', '任务记录'],
    highlights: [
      { title: '两类执行器', text: '静态接口优先 HTTP，动态页面按需使用受控浏览器。' },
      { title: '结构化解析', text: '从 HTML、JSON 或页面状态提取字段并清洗。' },
      { title: '资源有预算', text: '超时、并发、内存、重试和目标访问边界显式配置。' },
    ],
    demo: ['配置采集目标', '选择执行方式', '解析并映射字段', '调度与查看结果'],
    href: '/doc/system-engine/spider-engine.html', linkLabel: '打开采集引擎文档',
  },
  {
    id: 'job-engine', domain: 'integration', nav: '任务调度', title: '让定时任务与可靠后台任务持续运行',
    summary: 'Cron、队列、Worker、租约、重试与恢复构成分布式任务底座。', code: 'JOB', glyph: '◷', accent: '#5dc7ff',
    promise: '任务要按时开始，也要知道是否真正完成。', orbit: ['Cron', 'Worker', '租约', '重试恢复'],
    highlights: [
      { title: '两类任务', text: 'Quartz 定时触发与持久后台任务按可靠性需求选择。' },
      { title: '分布式安全', text: '共享租约、Fencing Token 和幂等避免多节点重复副作用。' },
      { title: '状态可追踪', text: '入队、领取、执行、完成和失败时间形成诊断证据。' },
    ],
    demo: ['创建调度规则', '编写任务处理器', '模拟失败重试', '观察多节点状态'],
    href: '/doc/system-engine/job.html', linkLabel: '打开任务调度文档',
  },
  {
    id: 'mq-engine', domain: 'integration', nav: 'MQ 消息队列', title: '用异步事件解耦高峰与跨系统协作',
    summary: 'RabbitMQ、生产、消费、Outbox/Inbox 与幂等共同保障消息链路。', code: 'MQ', glyph: '↝', accent: '#62d6ad',
    promise: '先可靠记录业务事实，再安全地触发外部副作用。', orbit: ['Producer', 'RabbitMQ', 'Consumer', '幂等'],
    highlights: [
      { title: '简单发送', text: 'V8.MQ.SendMsg 将业务对象投递到明确队列。' },
      { title: '可靠消费', text: '消费者读取 Message，执行业务并处理确认与失败。' },
      { title: '一致性模式', text: 'Outbox/Inbox、唯一约束和重试降低丢失与重复风险。' },
    ],
    demo: ['定义消息契约', '发送业务事件', '消费并写入结果', '验证重复消息'],
    href: '/doc/system-engine/mq.html', linkLabel: '打开 MQ 文档',
  },
  {
    id: 'mqtt-engine', domain: 'integration', nav: 'MQTT 引擎', title: '连接设备、传感器与实时 IoT 事件',
    summary: '服务生命周期、客户端、主题和原始载荷进入统一 V8 事件模型。', code: 'MQTT', glyph: '⌁', accent: '#42dbc1',
    promise: '让设备事件直接进入企业业务流程。', orbit: ['Broker', 'Topic', 'Device', 'V8 Event'],
    highlights: [
      { title: '事件清晰', text: '启动、连接、断开、消息到达和停止分别处理。' },
      { title: '上下文完整', text: 'ClientId、Topic、Payload 和租户配置可在 V8 中读取。' },
      { title: '业务联动', text: '设备数据可触发表单、告警、任务、通知与可视化。' },
    ],
    demo: ['配置 Broker', '订阅业务主题', '解析设备载荷', '触发告警与记录'],
    href: '/doc/system-engine/mqtt-engine.html', linkLabel: '打开 MQTT 引擎文档',
  },
  {
    id: 'notification-engine', domain: 'integration', nav: '消息通知', title: '系统公告与多渠道业务通知，一处管理',
    summary: '在消息通知中心维护公告、邮件短信、平台聊天与微信模板，AI 通过自己的 MCP 配置。', code: 'NOTICE', glyph: '✉', accent: '#73d9a8',
    promise: '从接收范围、触发计划到投递记录，形成可核验的通知闭环。', orbit: ['系统公告', '业务通知', '帐号范围', '投递记录'],
    highlights: [
      { title: '一个管理入口', text: '保留原通知配置与物理表，用接口引擎编排多通道发送。' },
      { title: '精准提醒', text: '支持当前用户、子租户、官方产品版本及超级管理员范围；可定时或在后端重启后提醒。' },
      { title: '安装即可配置', text: '应用商城统一交付，MCP 与 Skills 支持 AI 配置；SignalR 实时通知，接口轮询兜底。' },
    ],
    demo: ['安装消息通知应用', '用 AI 配置范围和计划', '预览并发布公告', '核对投递与关闭回执'],
    href: '/doc/system-engine/message-notification.html', linkLabel: '打开消息通知文档',
  },
  {
    id: 'ocr-engine', domain: 'integration', nav: 'OCR 识别引擎', title: '把票据、表格与图片文字转成业务数据',
    summary: '统一 OCR 网关、V8 原子能力、租户配置与结果验收。', code: 'OCR', glyph: '▣', accent: '#72c6ff',
    promise: '识别结果直接进入表单、流程和人工复核。', orbit: ['文本识别', '表格识别', '供应商路由', '结果复核'],
    highlights: [
      { title: '统一调用', text: 'V8.OCR 隔离具体供应商，业务代码保持稳定。' },
      { title: '租户配置', text: '模型、密钥、限额和策略属于当前租户事实源。' },
      { title: '结果有边界', text: '置信度、错误、原始文件和人工复核路径可追踪。' },
    ],
    demo: ['上传样例图片', '选择识别类型', '映射结构化字段', '人工复核并入库'],
    href: '/doc/system-engine/ocr-engine.html', linkLabel: '打开 OCR 引擎文档',
  },
  {
    id: 'vision-engine', domain: 'integration', nav: '视觉引擎', title: '让图像与连续画面进入可信业务识别链路',
    summary: '样本、对象、模型、单图识别、视频帧与 AI 回退组成视觉能力。', code: 'VISION', glyph: '◉', accent: '#8ab4ff',
    promise: '让“看到什么”成为可训练、可运营的业务能力。', orbit: ['对象样本', '单图识别', '视频帧', 'AI 回退'],
    highlights: [
      { title: '可训练对象', text: '对象、样本、状态和版本共同管理识别资产。' },
      { title: '多种输入', text: '支持单图与连续视频帧，并输出统一识别结果。' },
      { title: '隐私与回退', text: '人脸、关注对象、AI 回退和数据保留遵循明确边界。' },
    ],
    demo: ['录入识别对象', '添加训练样本', '运行单图与视频', '查看准确率与回退'],
    href: '/doc/system-engine/vision-engine.html', linkLabel: '打开视觉识别引擎文档',
  },
  {
    id: 'image-engine', domain: 'integration', nav: '图片处理', title: '在 V8 中完成生成、编辑、合成与二维码',
    summary: '图片创建、缩放、裁剪、旋转、合并、绘制和水印均为后端原子能力。', code: 'IMAGE', glyph: '▱', accent: '#ab8cff',
    promise: '无需额外图像服务，也能完成常见业务素材处理。', orbit: ['Create', 'Resize', 'Merge', 'QRCode'],
    highlights: [
      { title: '内存输入', text: 'Base64、Data URI 或字节输入，不直接读取任意本地路径。' },
      { title: '组合能力', text: '创建、合并、覆盖、裁剪、旋转、绘制与水印自由组合。' },
      { title: '业务场景', text: '证件照、标签、海报、缩略图与二维码可在线生成。' },
    ],
    demo: ['读取图片信息', '裁剪与缩放', '叠加文字水印', '生成二维码并返回'],
    href: '/doc/v8-engine/v8-server.html#图像处理-v8-image', linkLabel: '打开 V8.Image 文档',
  },
  {
    id: 'office-engine', domain: 'integration', nav: 'Office 引擎 / 在线编辑', title: '让 Excel、Word、PowerPoint 成为业务输入与输出',
    summary: '导入解析、复杂表格、富文本 Word、演示稿与邮件在 V8 中生成。', code: 'OFFICE', glyph: '▦', accent: '#58b8ff',
    promise: '把企业常用文档输出纳入自动化流程。', orbit: ['Excel', 'Word', 'PowerPoint', 'Email'],
    highlights: [
      { title: '结构化导入', text: 'Excel Sheet 可解析为业务列表，再进入校验与入库。' },
      { title: '专业导出', text: '单元格、公式、样式、页眉页脚、表格和分页可配置。' },
      { title: '流程联动', text: '审批结束后可自动生成文档、归档并通知相关人员。' },
    ],
    demo: ['读取 Excel', '生成多 Sheet 报表', '输出 Word/PPT', '邮件发送或归档'],
    href: '/doc/more/office.html', linkLabel: '打开 Office 引擎文档',
  },
  {
    id: 'file-engine', domain: 'integration', nav: '分布式存储 / HDFS', title: '统一管理业务文件、对象存储与跨平台同步',
    summary: '文件柜、公开/私有桶、预览、回收站、同步与 HDFS 指针共同工作。', code: 'FILE', glyph: '▰', accent: '#4dc4ff',
    promise: '文件是有权限、有版本、有生命周期的业务资产。', orbit: ['公私有桶', '在线预览', '回收站', 'MinIO / HDFS'],
    highlights: [
      { title: '统一文件柜', text: '文件夹、搜索、移动、复制、删除、恢复与权限集中管理。' },
      { title: '多存储后端', text: '本地、MinIO、OSS、S3 与分布式存储按部署选择。' },
      { title: '大资产友好', text: '内容通过指针和流式链路传递，避免塞进 AI 上下文。' },
    ],
    demo: ['上传公开与私有文件', '在线预览', '同步到远端存储', '删除并从回收站恢复'],
    href: '/doc/system-engine/file-manage.html', linkLabel: '打开文件柜文档',
  },
  {
    id: 'translate-engine', domain: 'integration', nav: '翻译引擎（多语言）', title: '让平台词条与业务内容进入多语言链路',
    summary: '词条、源语言、目标语言、缓存和外部翻译服务通过统一接口调用。', code: 'I18N', glyph: '文', accent: '#60d5cf',
    promise: '同一套业务能力，面向不同语言用户交付。', orbit: ['语言词条', '内容翻译', '缓存', '多端复用'],
    highlights: [
      { title: '平台词条', text: '界面标签与状态字典通过统一 Key 在多端读取。' },
      { title: '动态翻译', text: 'V8.TranslateEngine 可翻译业务文本并指定语言方向。' },
      { title: '结果复用', text: '稳定内容进入缓存，降低外部调用与响应时间。' },
    ],
    demo: ['维护语言词条', '切换界面语言', '调用内容翻译', '检查缓存与回退'],
    href: '/doc/system-engine/translate-engine.html', linkLabel: '打开翻译引擎文档',
  },
  {
    id: 'database-engine', domain: 'integration', nav: '多数据库 / ORM', title: '连接主库、扩展库与企业既有数据',
    summary: 'Dos.ORM、V8.Db、V8.Dbs 与 MCP Schema 覆盖多种数据库接入。', code: 'DB', glyph: '◉', accent: '#55d8e6',
    promise: '新系统与存量数据库可以在同一业务流程中协作。', orbit: ['MySQL', 'SQL Server', 'Oracle / PG', '达梦 / 金仓'],
    highlights: [
      { title: '多数据库支持', text: '主流关系库、MongoDB、Redis 与搜索存储按能力组合。' },
      { title: '扩展库动态生效', text: '租户维护连接后，多节点按版本刷新，无需重启。' },
      { title: '安全查询', text: '普通 CRUD 优先 FormEngine，SQL 动态值必须参数化。' },
    ],
    demo: ['登记扩展数据库', '读取实时 Schema', '参数化查询', '迁移数据与附件'],
    href: '/doc/system-engine/databases.html', linkLabel: '打开多数据库文档',
  },
  {
    id: 'observability-engine', domain: 'integration', nav: '系统日志 / 监控', title: '用日志、健康、指标与链路定位真实问题',
    summary: '运行状态、依赖降级、业务异常、任务时间线和审计证据分层观察。', code: 'OBSERVE', glyph: '⌁', accent: '#ffbd59',
    promise: '不仅知道“服务活着”，还知道业务是否完成。', orbit: ['日志', '健康检查', '指标', 'Trace'],
    highlights: [
      { title: '分层健康', text: '区分存活、就绪、依赖可用与具体业务结果。' },
      { title: '时间线诊断', text: '请求、任务、消息和外部调用串成可核对证据。' },
      { title: '多租户观测', text: '查询和审计继续遵循租户、用户与权限范围。' },
    ],
    demo: ['打开健康面板', '筛选业务日志', '追踪一次请求', '定位任务或依赖异常'],
    href: '/doc/system-engine/system-observability.html', linkLabel: '打开系统观测文档',
  },
  {
    id: 'security-engine', domain: 'integration', nav: '安全 / SSO / Passkey', title: '身份、权限、租户与敏感操作共同守边界',
    summary: 'DiyToken、角色部门、数据范围、SSO、Passkey 与私有文件统一治理。', code: 'TRUST', glyph: '◇', accent: '#ff8f6b',
    promise: 'AI 和自动化越强，可信身份与最小权限越重要。', orbit: ['DiyToken', '数据权限', 'SSO', 'Passkey'],
    highlights: [
      { title: '统一会话入口', text: '登录、SSO、OAuth 与强身份验证最终进入 DiyToken 权限体系。' },
      { title: '多层授权', text: '菜单、按钮、表、字段、行范围和服务端动作分别校验。' },
      { title: '秘密不外泄', text: '密钥留在可信后端，私有文件、显示明文和敏感动作独立审计。' },
    ],
    demo: ['配置角色与范围', '接入 SSO', '触发 Passkey 验证', '检查私有文件与审计'],
    href: '/doc/more/security.html', linkLabel: '打开平台安全文档',
  },
  {
    id: 'server-panel', domain: 'integration', nav: '服务器运维面板', title: '从服务器环境到网站入口，统一在独立面板维护',
    summary: 'Microi.Panel 提供 Docker 插件市场、Nginx、HTTPS、网站文件、备份恢复和持久运维任务。', code: 'PANEL', glyph: '▤', accent: '#68bce8',
    promise: '业务平台更新或停机时，仍能打开自己的运维入口。', orbit: ['Docker 插件', 'Nginx / HTTPS', '备份恢复', '独立登录'],
    highlights: [
      { title: '独立安装与版本选择', text: '面板直接提供 HTTPS，按需安装数据库、MinIO、翻译与 OCR，各实例保留独立数据卷。' },
      { title: '网站与恢复', text: '可视化代理与静态站点，证书申请续期、配置校验、冷备份及新卷恢复统一记录结果。' },
      { title: '共存与权限', text: '与已有面板使用不同端口；主机管理员独立登录，业务 DiyToken 不授予 Docker 权限。' },
    ],
    demo: ['一键安装独立面板', '选择插件和版本', '配置网站与证书', '演练备份和任务恢复'],
    href: '/doc/server-panel/overview.html', linkLabel: '打开服务器运维面板文档',
  },
  {
    id: 'visualization-engine', domain: 'experience', nav: '3D / CAD / 大屏', title: '从经营驾驶舱到工程可视化',
    summary: 'go-view 数据大屏、3D 场景与 CAD 预览按交互复杂度选择。', code: 'VIS', glyph: '⬡', accent: '#9b8cff',
    promise: '用合适的可视化技术回答不同业务问题。', orbit: ['go-view', '3D', 'CAD', '数据大屏'],
    highlights: [
      { title: '经营大屏', text: '指标、图表、地图和轮播面向监控与展示。' },
      { title: '空间场景', text: '3D 组件承接园区、产线、设备和数字孪生。' },
      { title: '工程文件', text: 'CAD 与复杂资产通过文件链路和租户权限受控预览。' },
    ],
    demo: ['选择可视化类型', '绑定业务数据', '配置交互联动', '检查资产与权限'],
    href: '/doc/system-engine/visualization-engine.html', linkLabel: '打开 3D/CAD/大屏文档',
  },
  {
    id: 'unity-engine', domain: 'experience', nav: 'Unity / WebGL', title: '让 Unity 场景接入吾码业务与身份',
    summary: 'UPM SDK、WebGL、业务 API、文件与租户上下文连接沉浸式应用。', code: 'UNITY', glyph: '△', accent: '#8ab4ff',
    promise: '三维体验与企业数据不再是两套孤立系统。', orbit: ['UPM SDK', 'WebGL', 'DiyToken', '数字孪生'],
    highlights: [
      { title: '统一接入', text: 'Unity 客户端复用吾码登录、接口、文件和租户能力。' },
      { title: '双形态交付', text: '原生 App 与 WebGL 嵌入网页按终端性能选择。' },
      { title: '业务驱动场景', text: '设备、工单、模型与实时消息共同驱动三维状态。' },
    ],
    demo: ['安装 UPM SDK', '连接租户与登录', '调用业务接口', '发布 WebGL 场景'],
    href: '/doc/system-engine/unity-integration.html', linkLabel: '打开 Unity 集成文档',
  },
]

// 这些是官网左侧导航中的关键交付入口，已有独立培训页或由相邻引擎页承接，
// 因此只补进总览而不重复制造内容相同的详情幻灯片。
const atlasSupplementalEntries: AtlasEntry[] = [
  { id: 'ai-dev-tools', nav: 'AI 开发工具（VS Code + CLI）', href: '/doc/v8-engine/vs-code-plugin.html' },
  { id: 'mcp-server', nav: 'MCP Server 完整指南', href: '/doc/v8-engine/mcp-server.html' },
  { id: 'multi-end-client', nav: 'PC、WebOS 与移动端', href: '/doc/system-engine/multi-end-client.html' },
  { id: 'file-manage', nav: '文件柜', href: '/doc/system-engine/file-manage.html' },
  { id: 'system-settings', nav: '系统设置', href: '/doc/more/sys-config.html' },
  { id: 'bluetooth-print', nav: '蓝牙打印机', href: '/doc/system-engine/bluetooth-printer.html' },
]

const atlasEntries: AtlasEntry[] = [...engineSlides, ...atlasSupplementalEntries]

const introSlides: SlideMeta[] = [
  { id: 'opening', chapter: '01', kind: 'cover', nav: '培训开场', title: 'Microi吾码 AI 开发框架', summary: '面向企业研发团队的功能培训与实战讲解大纲。' },
  { id: 'framework-choice', chapter: '02', kind: 'decision', nav: '框架选型', title: '企业研发，为什么要先选一套开源 AI 开发框架？', summary: '直接从需求生成代码与基于成熟框架开发，关注点和长期成本完全不同。' },
  { id: 'why-microi', chapter: '03', kind: 'why', nav: '为什么选择吾码？', title: '为什么选择吾码？', summary: 'AI 原生、企业级、全生命周期——通用能力全部复用，团队只聚焦业务差异。' },
  { id: 'quick-start', chapter: '04', kind: 'start', nav: '快速开始', title: '三种方式开始使用，再让 AI 接管开发环境', summary: '先获得可运行平台，再通过 VS Code、CLI 与 MCP 建立 AI 交付链路。' },
  { id: 'engine-atlas', chapter: '05', kind: 'atlas', nav: '30+ 引擎总览', title: '一张架构图，进入 Microi吾码全部核心能力', summary: '选择企业最关心的引擎现场展开；每个入口都打开对应官方文档。' },
  { id: 'mcp-delivery', chapter: '06', kind: 'mcp', nav: 'MCP 智能交付', title: 'MCP 让 AI 理解、操作并验收真实平台', summary: '不是复制代码答案，而是读取事实、预演变更、受控执行并自动回读。' },
]

const outroSlides: SlideMeta[] = [
  { id: 'multi-end', chapter: '45', kind: 'multi-end', nav: '全端兼容', title: '一套业务能力，进入企业每一个终端', summary: 'PC、WebOS、H5、小程序、Android、iOS、微服务与 Unity 共享平台能力。' },
  { id: 'success-cases', chapter: '46', kind: 'cases', nav: '成功案例', title: '跨越行业边界，让业务价值落地', summary: '从工厂车间到商业服务，从组织管理到公共运营，Microi吾码已在多类行业的实际业务中落地应用。' },
  { id: 'closing', chapter: '47', kind: 'closing', nav: '致辞', title: '把 AI 的速度，变成企业可持续交付力', summary: '掌握平台能力，建立可复用、可验证、可演进的 AI 研发方式。' },
]

const slideMeta: SlideMeta[] = [
  ...introSlides,
  ...engineSlides.map((engine, index) => ({
    id: engine.id,
    chapter: String(index + 7).padStart(2, '0'),
    kind: 'engine' as const,
    nav: engine.nav,
    title: engine.title,
    summary: engine.summary,
    engine,
  })),
  ...outroSlides,
]

const expectedSlideCount = 47
if (slideMeta.length !== expectedSlideCount) throw new Error(`培训 PPT 页数异常：${slideMeta.length}/${expectedSlideCount}`)

const atlasGroups: AtlasGroup[] = [
  { code: '01', title: 'AI 开发与低代码', entryIds: ['form-engine', 'module-engine', 'v8-engine', 'api-engine', 'workflow-engine', 'template-engine', 'ai-dev-tools', 'mcp-server'] },
  { code: '02', title: '界面与全端交付', entryIds: ['page-engine', 'report-engine', 'microservice-engine', 'microi-ui', 'email-engine', 'visualization-engine', 'unity-engine', 'multi-end-client'] },
  { code: '03', title: 'AI 与智能产品', entryIds: ['app-store', 'ai-engine', 'ai-data-analysis', 'ai-creative-studio', 'ai-workflow-suite', 'ai-governance', 'vision-engine', 'image-engine'] },
  { code: '04', title: '数据、文件与检索', entryIds: ['cache-engine', 'search-engine', 'database-engine', 'file-engine', 'file-manage', 'office-engine', 'translate-engine'] },
  { code: '05', title: '自动化、消息与设备', entryIds: ['print-engine', 'bluetooth-print', 'spider-engine', 'job-engine', 'mq-engine', 'mqtt-engine', 'notification-engine', 'ocr-engine'] },
  { code: '06', title: '租户、安全与运维', entryIds: ['saas-engine', 'system-settings', 'security-engine', 'observability-engine', 'server-panel'] },
]

const atlasEntryIds = atlasGroups.flatMap(group => group.entryIds)
if (atlasEntryIds.length !== atlasEntries.length || new Set(atlasEntryIds).size !== atlasEntries.length || atlasEntries.some(entry => !atlasEntryIds.includes(entry.id))) {
  throw new Error('培训 PPT 引擎总览必须完整且每项只出现一次')
}

const activationLinks = [
  { label: 'VS Code 插件', href: '/doc/v8-engine/vs-code-plugin.html' },
  { label: 'MCP Server', href: '/doc/v8-engine/mcp-server.html' },
  { label: '@microi.net/cli', href: '/doc/v8-engine/mcp-server.html#cli' },
]

const mcpSteps = [
  { no: '01', title: '读取事实', text: 'Schema · 应用 · 权限' },
  { no: '02', title: '形成计划', text: '蓝图 · Manifest' },
  { no: '03', title: '预演变更', text: 'Plan · Dry Run' },
  { no: '04', title: '受控执行', text: 'Confirm · Apply' },
  { no: '05', title: '自动验收', text: 'Validate · Readback' },
]

const devices = [
  { code: 'PC', title: 'PC 管理端', text: '高密度业务管理与设计' },
  { code: 'OS', title: 'WebOS', text: '桌面化多任务入口' },
  { code: 'H5', title: '移动端 H5', text: '浏览器与企业微信场景' },
  { code: 'WX', title: '微信小程序', text: '轻量触达与业务办理' },
  { code: 'ALI', title: '支付宝小程序', text: '服务与商业场景' },
  { code: 'DY', title: '抖音小程序', text: '内容与用户触达' },
  { code: 'APK', title: 'Android App', text: 'UniApp 原生容器能力' },
  { code: 'IOS', title: 'iOS App', text: '统一源码多端构建' },
  { code: 'MICRO', title: '前端微服务', text: '复杂页面独立或嵌入' },
  { code: '3D', title: 'Unity / WebGL', text: '数字孪生与沉浸场景' },
]

// 场景归纳自 case-index 的公开清单，只展示业务类别；不复制客户、系统名称或推断单案收益。
const caseIndustries = [
  { title: '工业制造', scenes: '纺织服装 · 机械制造 · 汽车配套', icon: 'M3 21V9l6 3V9l6 3V3h5v18H3ZM7 16h1m3 0h1m4 0h1M7 19h1m3 0h1m4 0h1' },
  { title: '商贸与消费', scenes: '零售商城 · 进销存 · 会员服务', icon: 'M3 10l2-6h14l2 6M4 10v10h16V10M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6' },
  { title: '组织与经营', scenes: '人力资源 · 财税服务 · 资产管理', icon: 'M8 7V4h8v3M3 7h18v13H3V7Zm0 6 9 3 9-3M10 12h4' },
  { title: '园区与公共服务', scenes: '园区运营 · 智慧社区 · 停车服务', icon: 'M3 21V9h8v12M11 21V3h10v18M6 13h2m-2 4h2m6-10h4m-4 4h4m-4 4h4M2 21h20' },
  { title: '专业服务', scenes: '医疗健康 · 教育教务 · 法律服务', icon: 'M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4V5Zm8 2v14M7 9h2m-2 4h2m6-4h2m-2 4h2' },
  { title: '物流与农业', scenes: '国际物流 · 农业牧场 · 物联管理', icon: 'M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5V15' },
]

const deckRef = ref<HTMLElement | null>(null)
const { isDark } = useData()
const panelCloseRef = ref<HTMLButtonElement | null>(null)
const thumbnailRailRef = ref<HTMLElement | null>(null)
const pdfDownloadRef = ref<HTMLAnchorElement | null>(null)
const activeIndex = ref(0)
const direction = ref<'next' | 'prev'>('next')
const activePanel = ref<DeckPanel>('')
const isFullscreen = ref(false)
const isPaused = ref(false)
const isArtifactCapture = ref(false)
const captureScale = ref(1)
const notice = ref('')
const railCollapsed = ref(false)
const searchKeyword = ref('')
const slideSearchContent = ref<string[]>([])
const visibleSlides = computed(() => searchTrainingSlides(slideMeta, slideSearchContent.value, searchKeyword.value))
const currentSlide = computed(() => slideMeta[activeIndex.value])
const progress = computed(() => ((activeIndex.value + 1) / slideMeta.length) * 100)

let wheelLockedUntil = 0
let wheelAccumulator = 0
let wheelDirection: -1 | 0 | 1 = 0
let wheelResetTimer = 0
let pointerStart: { id: number; x: number; y: number } | null = null
let noticeTimer = 0
let focusBeforePanel: HTMLElement | null = null

function padSlide(index: number) { return String(index + 1).padStart(2, '0') }
function entriesInAtlasGroup(group: AtlasGroup) { return group.entryIds.map(id => atlasEntries.find(entry => entry.id === id)).filter((entry): entry is AtlasEntry => Boolean(entry)) }
function isInteractiveTarget(target: EventTarget | null) { return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"]')) }

function resetWheelIntent() {
  wheelAccumulator = 0
  wheelDirection = 0
  window.clearTimeout(wheelResetTimer)
}

function resetActiveFrameScroll(index = activeIndex.value) {
  nextTick(() => {
    const slide = slideMeta[index]
    const frame = slide ? deckRef.value?.querySelector<HTMLElement>(`#mci-training-${slide.id} .mci-training-slide__frame`) : null
    if (frame) frame.scrollTop = 0
  })
}

function announce(message: string) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2600)
}

function updateHash(index: number) {
  if (typeof window === 'undefined') return
  const nextHash = `#slide-${padSlide(index)}`
  if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash)
}

function goTo(index: number, nextDirection?: 'next' | 'prev') {
  const nextIndex = Math.max(0, Math.min(slideMeta.length - 1, index))
  if (nextIndex === activeIndex.value) return
  direction.value = nextDirection || (nextIndex > activeIndex.value ? 'next' : 'prev')
  activeIndex.value = nextIndex
  activePanel.value = ''
  updateHash(nextIndex)
  scrollActiveThumbnail()
  resetActiveFrameScroll(nextIndex)
}

function scrollActiveThumbnail(moveFocus = false) {
  if (moveFocus) { railCollapsed.value = false; searchKeyword.value = '' }
  nextTick(() => {
    const button = thumbnailRailRef.value?.querySelector<HTMLButtonElement>(`[data-slide-index="${activeIndex.value}"]`)
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    if (moveFocus) button?.focus()
  })
}

function nextSlide() { goTo(activeIndex.value + 1, 'next') }
function previousSlide() { goTo(activeIndex.value - 1, 'prev') }

function thumbnailPath(index: number) {
  const themeFolder = isDark.value ? 'thumbs' : 'thumbs-light'
  return `/images/training-deck/${themeFolder}/slide-${padSlide(index)}.webp`
}

function openPanel(panel: Exclude<DeckPanel, ''>) {
  focusBeforePanel = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activePanel.value = panel
  nextTick(() => panelCloseRef.value?.focus())
}

function closePanel() {
  activePanel.value = ''
  nextTick(() => focusBeforePanel?.focus())
}

async function toggleFullscreen() {
  if (!deckRef.value) return
  try {
    if (!document.fullscreenElement) await deckRef.value.requestFullscreen()
    else await document.exitFullscreen()
  } catch {
    announce('当前浏览器未允许全屏，请使用浏览器菜单进入全屏。')
  }
}

function downloadPdf() {
  activePanel.value = ''
  pdfDownloadRef.value?.click()
}

function handleKeydown(event: KeyboardEvent) {
  // 浏览器搜索、打印、F11 等组合键及输入法始终保留默认行为。
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const key = event.key
  if (key === 'Escape' && activePanel.value) {
    event.preventDefault()
    closePanel()
    return
  }
  if (activePanel.value) return
  if (isInteractiveTarget(event.target)) return

  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(key)) {
    event.preventDefault()
    nextSlide()
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) {
    event.preventDefault()
    previousSlide()
  } else if (key === 'Home') {
    event.preventDefault()
    goTo(0, 'prev')
  } else if (key === 'End') {
    event.preventDefault()
    goTo(slideMeta.length - 1, 'next')
  } else if (key.toLowerCase() === 'o') {
    event.preventDefault()
    scrollActiveThumbnail(true)
  } else if (key === '?' || key.toLowerCase() === 'h') {
    event.preventDefault()
    openPanel('help')
  } else if (key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    downloadPdf()
  }
}

function handleWheel(event: WheelEvent) {
  if (activePanel.value || event.ctrlKey || event.metaKey || Date.now() < wheelLockedUntil) return
  if (event.target instanceof Element && event.target.closest('.mci-training-deck__rail')) return
  const isVertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
  const rawDelta = isVertical ? event.deltaY : event.deltaX
  if (Math.abs(rawDelta) < .5) return
  const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
  const primaryDelta = rawDelta * deltaScale
  const intentDirection: -1 | 1 = primaryDelta > 0 ? 1 : -1
  if (isVertical) {
    const frame = deckRef.value?.querySelector<HTMLElement>('.mci-training-slide.is-active .mci-training-slide__frame') || null
    if (frame && frame.scrollHeight > frame.clientHeight + 2) {
      const atStart = frame.scrollTop <= 1
      const atEnd = frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1
      if ((primaryDelta > 0 && !atEnd) || (primaryDelta < 0 && !atStart)) {
        resetWheelIntent()
        return
      }
    }
  }
  if (event.cancelable) event.preventDefault()
  if (wheelDirection !== intentDirection) {
    wheelAccumulator = 0
    wheelDirection = intentDirection
  }
  wheelAccumulator += Math.abs(primaryDelta)
  window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(resetWheelIntent, 180)
  if (wheelAccumulator < 48) return
  resetWheelIntent()
  wheelLockedUntil = Date.now() + 480
  if (intentDirection > 0) nextSlide()
  else previousSlide()
}

function handlePointerDown(event: PointerEvent) {
  if (activePanel.value || isInteractiveTarget(event.target) || event.button !== 0) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  deckRef.value?.setPointerCapture?.(event.pointerId)
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const deltaX = event.clientX - pointerStart.x
  const deltaY = event.clientY - pointerStart.y
  pointerStart = null
  if (Math.abs(deltaX) < 58 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) return
  if (deltaX < 0) nextSlide()
  else previousSlide()
}

function handleFullscreenChange() { isFullscreen.value = document.fullscreenElement === deckRef.value }
function handleVisibilityChange() { isPaused.value = document.hidden }

function handleHashChange() {
  const match = /^#slide-(\d{2})$/u.exec(window.location.hash)
  if (!match) return
  const index = Number(match[1]) - 1
  if (index >= 0 && index < slideMeta.length && index !== activeIndex.value) goTo(index)
}

onMounted(() => {
  railCollapsed.value = window.innerWidth < 768
  nextTick(() => {
    // 全部幻灯片都已渲染：同时索引实际正文、演示步骤与标题，不依赖关键词短清单。
    slideSearchContent.value = slideMeta.map(slide => deckRef.value?.querySelector(`#mci-training-${slide.id}`)?.textContent || '')
  })
  isArtifactCapture.value = new URLSearchParams(window.location.search).has('artifact-capture')
  if (isArtifactCapture.value) captureScale.value = Math.min(window.innerWidth / 1600, window.innerHeight / 900)
  handleHashChange()
  scrollActiveThumbnail()
  resetActiveFrameScroll()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('hashchange', handleHashChange)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('hashchange', handleHashChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.clearTimeout(noticeTimer)
  window.clearTimeout(wheelResetTimer)
})
</script>

<template>
  <div ref="deckRef" class="mci-training-deck mci-page" data-mci-ui-root="training-syllabus-deck" data-mci-shape="rounded" :data-direction="direction" :class="{ 'is-paused': isPaused, 'is-fullscreen': isFullscreen, 'is-artifact-capture': isArtifactCapture, 'is-rail-collapsed': railCollapsed }" :style="isArtifactCapture ? { '--mci-deck-capture-scale': captureScale } : undefined" role="region" aria-label="Microi吾码 AI 开发框架技术培训幻灯片" @wheel="handleWheel" @pointerdown="handlePointerDown" @pointerup="handlePointerUp" @pointercancel="pointerStart = null">
    <div class="mci-training-deck__atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
    <a class="mci-training-deck__skip" href="#mci-training-controls">跳到演示控制</a>

    <header class="mci-training-deck__topbar">
      <button class="mci-training-brand" type="button" aria-label="返回第一张幻灯片" @click="goTo(0, 'prev')"><img src="/icon.png" alt="" aria-hidden="true"><span><strong>Microi吾码</strong><small>AI DEVELOPMENT FRAMEWORK</small></span></button>
      <div class="mci-training-deck__top-actions" aria-label="演示工具">
        <button type="button" :aria-label="railCollapsed ? '展开导航' : '收起导航'" :aria-expanded="!railCollapsed" aria-controls="mci-training-navigation" :title="railCollapsed ? '展开搜索与导航' : '收起导航，扩大演示区域'" @click="railCollapsed = !railCollapsed"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5 8h2m-2 4h2m-2 4h2"/></svg><span>导航</span></button>
        <button type="button" aria-label="查看操作帮助" aria-keyshortcuts="H" title="操作帮助（H / ?）" @click="openPanel('help')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.2 2.26c-.7.32-1 .76-1 1.49M12 17h.01"/></svg><span>帮助</span></button>
        <button type="button" aria-label="切换全屏" title="也可使用浏览器 F11 全屏" @click="toggleFullscreen"><svg v-if="!isFullscreen" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg><span>{{ isFullscreen ? '退出' : '全屏' }}</span></button>
        <a ref="pdfDownloadRef" class="is-primary is-dark-pdf" :href="pdfDownloadPaths.dark" download aria-label="下载预生成暗色 PDF" aria-keyshortcuts="P" title="下载暗色 PDF（P）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 15h4M12 11v7m0 0-2-2m2 2 2-2"/></svg><span>暗色 PDF</span></a>
        <a class="is-light-pdf" :href="pdfDownloadPaths.light" download aria-label="下载预生成浅色 PDF" title="下载浅色 PDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 15h4M12 11v7m0 0-2-2m2 2 2-2"/></svg><span>浅色 PDF</span></a>
      </div>
    </header>

    <aside v-show="!railCollapsed" id="mci-training-navigation" class="mci-training-deck__rail mci-screen-only" aria-label="幻灯片缩略图导航"><header><span>培训导航</span><strong>{{ visibleSlides.length }} / {{ slideMeta.length }}</strong></header>
      <label class="mci-training-deck__search"><input v-model="searchKeyword" type="search" aria-label="搜索标题与内容" placeholder="搜索标题与内容" autocomplete="off"><small role="status">{{ searchKeyword ? `找到 ${visibleSlides.length} 页` : '可搜索正文、功能与演示步骤' }}</small></label>
      <nav ref="thumbnailRailRef">
      <p v-if="!visibleSlides.length" class="mci-training-deck__search-empty">没有匹配的页面，请尝试其他关键词。</p>
      <button v-for="{ slide, index } in visibleSlides" :key="`thumbnail-${slide.id}`" type="button" :data-slide-index="index" :class="{ 'is-active': index === activeIndex }" :aria-current="index === activeIndex ? 'page' : undefined" :aria-label="`第 ${index + 1} 页：${slide.title}`" @click="goTo(index)">
        <span class="mci-training-deck__thumbnail"><img :src="thumbnailPath(index)" :alt="`${slide.title}${isDark ? '暗色' : '浅色'}预览图`" loading="lazy"><i>{{ padSlide(index) }}</i></span><span class="mci-training-deck__thumbnail-copy"><strong>{{ slide.nav }}</strong><small>{{ slide.title }}</small></span>
      </button>
    </nav></aside>

    <main class="mci-training-deck__stage" aria-live="off">
      <section v-for="(slide, index) in slideMeta" :key="slide.id" :id="`mci-training-${slide.id}`" class="mci-training-slide" :class="[`is-${slide.id}`, `is-kind-${slide.kind}`, { 'is-active': index === activeIndex }]" :aria-hidden="index === activeIndex ? 'false' : 'true'" :inert="index === activeIndex ? undefined : true" role="group" aria-roledescription="slide" :aria-label="`${index + 1} / ${slideMeta.length}，${slide.title}`">
        <div class="mci-training-slide__frame">
          <template v-if="slide.kind === 'cover'">
            <div class="mci-deck-cover-copy"><p class="mci-deck-eyebrow mci-deck-reveal">MICROI · ENTERPRISE TECHNICAL TRAINING</p><h1 class="mci-deck-cover-title mci-deck-reveal"><span>Microi吾码</span><strong>AI 开发框架</strong><em>技术培训大纲</em></h1><p class="mci-deck-cover-lead mci-deck-reveal">以功能点为路线，现场完成平台认知、引擎讲解、AI 开发与企业交付。</p><div class="mci-deck-cover-metrics mci-deck-reveal" aria-label="培训核心价值"><span><strong>10×+</strong> Token 更省*</span><span><strong>10×+</strong> AI 开发更快*</span><span><strong>30+</strong> 成熟引擎</span></div><p class="mci-deck-cover-proof mci-deck-reveal">成熟底座承接通用能力，让 AI 专注企业真正有差异的业务。<small>* 典型平台能力高复用场景，实际收益取决于需求与团队基线。</small></p><button class="mci-deck-start mci-deck-reveal mci-screen-only" type="button" @click="nextSlide">开始培训<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>
            <div class="mci-deck-core-visual mci-deck-reveal" aria-label="Microi 核心能力示意图"><div class="mci-deck-core-orbit is-outer"><span>30+ ENGINES</span><i></i><i></i></div><div class="mci-deck-core-orbit is-middle"><span>MCP + SKILLS</span><i></i><i></i></div><div class="mci-deck-core-orbit is-inner"><span>V8 RUNTIME</span><i></i></div><div class="mci-deck-core-mark"><img src="/icon.png" alt="Microi吾码"><strong>AI</strong><small>BUILD · RUN · DELIVER</small></div></div>
          </template>

          <template v-else-if="slide.kind === 'decision'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">02 · FRAMEWORK DECISION</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-choice-map"><article class="mci-choice-lane is-direct mci-deck-reveal"><header><span>PATH A</span><h3>AI 直接从需求开始开发</h3></header><strong>自由度高</strong><div class="mci-choice-stack"><span>业务代码</span><span>身份权限</span><span>表单流程</span><span>文件消息</span><span>部署运维</span></div><p>团队需要同时设计业务与通用底座，并持续把完整工程上下文交给 AI。</p></article><div class="mci-choice-axis mci-deck-reveal"><span>企业系统的真正差异</span><strong>业务规则</strong><i></i><small>通用能力应尽量复用</small></div><article class="mci-choice-lane is-framework mci-deck-reveal"><header><span>PATH B</span><h3>基于成熟开源 AI 框架开发</h3></header><strong>复用度高</strong><div class="mci-choice-stack"><span>30+ 引擎</span><span>统一权限</span><span>MCP / Skills</span><span>多端交付</span><span>生产治理</span></div><p>AI 读取真实结构并调用成熟能力，研发集中处理企业差异与验收。</p></article></div>
            <div class="mci-choice-verdict mci-deck-reveal"><span>选型判断</span><strong>当系统需要长期迭代、多人协作、权限流程、多端与运维时，开源 AI 开发框架就是研发杠杆。</strong></div>
          </template>

          <template v-else-if="slide.kind === 'why'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">03 · WHY MICROI</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-why-layout">
              <section class="mci-why-command" aria-label="Microi吾码企业应用能力矩阵">
                <div class="mci-why-rail is-left" aria-label="Microi吾码开发底座优势"><article v-for="(advantage, advantageIndex) in whyAdvantagesOn('left')" :key="advantage.no" class="mci-why-node mci-deck-reveal" :style="{ '--mci-deck-order': advantageIndex }"><span>{{ advantage.no }}</span><div><small>{{ advantage.code }}</small><strong>{{ advantage.title }}</strong><p>{{ advantage.proof }}</p></div><i aria-hidden="true"></i></article></div>
                <div class="mci-why-hub mci-deck-reveal" aria-label="从一句业务需求到大型企业应用上线"><i class="mci-why-hub__ring is-a" aria-hidden="true"></i><i class="mci-why-hub__ring is-b" aria-hidden="true"></i><div class="mci-why-hub__mark"><img src="/icon.png" alt="Microi吾码"><span>AI NATIVE · ENTERPRISE READY</span></div><strong>一句话，<em>开发大型企业应用</em></strong><small>真实 Schema · 权限 · 30+ 引擎上下文</small><ol class="mci-why-flow" aria-label="从需求到运行治理的五步闭环"><li v-for="(stage, stageIndex) in whyDeliveryStages" :key="stage"><i>{{ String(stageIndex + 1).padStart(2, '0') }}</i><span>{{ stage }}</span></li></ol><b>零代码提速，工程化不设上限</b></div>
                <div class="mci-why-rail is-right" aria-label="Microi吾码交付治理优势"><article v-for="(advantage, advantageIndex) in whyAdvantagesOn('right')" :key="advantage.no" class="mci-why-node mci-deck-reveal" :style="{ '--mci-deck-order': advantageIndex + 4 }"><i aria-hidden="true"></i><div><small>{{ advantage.code }}</small><strong>{{ advantage.title }}</strong><p>{{ advantage.proof }}</p></div><span>{{ advantage.no }}</span></article></div>
              </section>
              <footer class="mci-why-proof mci-deck-reveal" aria-label="Microi吾码可信基础"><span v-for="signal in whyTrustSignals" :key="signal"><i aria-hidden="true"></i>{{ signal }}</span><strong>一套底座，贯通开发、交付与长期演进</strong></footer>
            </div>
          </template>

          <template v-else-if="slide.kind === 'start'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">04 · START IN MINUTES</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-start-paths"><a class="mci-start-card is-recommended mci-deck-reveal" href="/doc/getting-started/docker-run.html" target="_blank" rel="noopener noreferrer"><span>01 · 强烈建议</span><h3>一键安装开始使用</h3><p>按官方文档执行一条安装命令，适合非专业研发人员与快速试用。</p><strong>Docker 一键安装 ↗</strong></a><a class="mci-start-card mci-deck-reveal" href="/doc/getting-started/local-run.html" target="_blank" rel="noopener noreferrer"><span>02 · 源码开发者</span><h3>拉取 Gitee 源码本地运行</h3><p>适合希望研究架构、调试内核和参与源码开发的专业用户。</p><strong>本地编译运行 ↗</strong></a><a class="mci-start-card mci-deck-reveal" href="/login.html?tab=register" target="_blank" rel="noopener noreferrer"><span>03 · 零安装体验</span><h3>官网注册并开通免费 SaaS 租户</h3><p>注册账号、创建独立租户数据库，直接进入在线平台体验。</p><strong>免费注册 SaaS ↗</strong></a></div>
            <div class="mci-start-ai mci-deck-reveal"><div><span>NEXT · AI READY</span><strong>让 AI 自动连接 Microi吾码</strong><p>VS Code 安装 Microi吾码插件；或在 Codex、WorkBuddy、Claude Code 等工具中安装 <code>@microi.net/cli</code>。在本地安全录入平台地址、账号和密码后，自然语言让 AI 添加 MCP 并初始化配置。</p></div><nav aria-label="AI 开发接入文档"><a v-for="item in activationLinks" :key="item.label" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.label }} ↗</a></nav></div>
          </template>

          <template v-else-if="slide.kind === 'atlas'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">05 · 30+ ENGINE ATLAS</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-atlas-layout"><a class="mci-atlas-architecture mci-deck-reveal" href="/images/microi-ai-platform-architecture-2026.09.04.1.svg" target="_blank" rel="noopener noreferrer" aria-label="新窗口打开 Microi吾码 AI 平台完整架构图"><picture><source srcset="/images/microi-ai-platform-architecture-2026.09.04.1-3840x2160.png 3840w, /images/microi-ai-platform-architecture-2026.09.04.1-1920x1080.png 1920w"><img src="/images/microi-ai-platform-architecture-2026.09.04.1-1920x1080.png" alt="Microi吾码 AI 平台 30+ 引擎系统架构图"></picture><span>打开 SVG 高清架构图 ↗</span></a><div class="mci-atlas-directory"><article v-for="(group, groupIndex) in atlasGroups" :key="group.code" class="mci-atlas-domain mci-deck-reveal" :style="{ '--mci-deck-order': groupIndex }"><header><span>{{ group.code }}</span><strong>{{ group.title }}</strong></header><div><a v-for="entry in entriesInAtlasGroup(group)" :key="entry.id" :href="entry.href" target="_blank" rel="noopener noreferrer">{{ entry.nav }}<i>↗</i></a></div></article></div></div>
          </template>

          <template v-else-if="slide.kind === 'mcp'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">06 · MCP DELIVERY LOOP</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-mcp-stage"><div class="mci-mcp-orbit mci-deck-reveal"><i></i><div><span>MICROI</span><strong>MCP</strong><small>TOOLS · SCHEMA · CONTEXT</small></div><b class="is-a">表 / 字段</b><b class="is-b">菜单 / 权限</b><b class="is-c">V8 / 流程</b><b class="is-d">应用 / 发布</b></div><div class="mci-mcp-flow"><article v-for="(step, stepIndex) in mcpSteps" :key="step.no" class="mci-deck-reveal" :style="{ '--mci-deck-order': stepIndex }"><span>{{ step.no }}</span><div><strong>{{ step.title }}</strong><small>{{ step.text }}</small></div><i v-if="stepIndex < mcpSteps.length - 1">→</i></article></div></div>
            <div class="mci-mcp-proof mci-deck-reveal"><strong>为什么 Token 更省、速度更快？</strong><span>精确 Schema 代替整库上下文</span><span>成熟引擎代替重复代码</span><span>Dry Run + 回读减少返工</span><a href="/doc/v8-engine/mcp-server.html" target="_blank" rel="noopener noreferrer">打开 MCP 文档 ↗</a></div>
          </template>

          <template v-else-if="slide.kind === 'engine' && slide.engine">
            <header class="mci-training-slide__heading mci-engine-slide-heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">{{ slide.chapter }} · {{ slide.engine.code }} ENGINE TRAINING</p><h2 class="mci-engine-slide-title"><span>{{ slide.engine.nav }}</span><small>{{ slide.title }}</small></h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-engine-layout" :style="{ '--mci-engine-accent': slide.engine.accent }"><div class="mci-engine-visual mci-deck-reveal"><div class="mci-engine-visual__grid"></div><i class="mci-engine-visual__ring is-a"></i><i class="mci-engine-visual__ring is-b"></i><div class="mci-engine-visual__core"><span>{{ slide.engine.glyph }}</span><strong>{{ slide.engine.code }}</strong><small>MICROI ENGINE</small></div><b v-for="(item, orbitIndex) in slide.engine.orbit" :key="item" :class="`is-orbit-${orbitIndex + 1}`">{{ item }}</b></div><div class="mci-engine-content"><blockquote class="mci-deck-reveal">{{ slide.engine.promise }}</blockquote><div class="mci-engine-highlights"><article v-for="(item, itemIndex) in slide.engine.highlights" :key="item.title" class="mci-deck-reveal" :style="{ '--mci-deck-order': itemIndex }"><span>0{{ itemIndex + 1 }}</span><div><strong>{{ item.title }}</strong><small>{{ item.text }}</small></div></article></div><div class="mci-engine-demo mci-deck-reveal"><span>现场演示</span><ol><li v-for="(step, stepIndex) in slide.engine.demo" :key="step"><i>{{ stepIndex + 1 }}</i>{{ step }}</li></ol></div><a class="mci-engine-doc-link mci-deck-reveal" :href="slide.engine.href" target="_blank" rel="noopener noreferrer">{{ slide.engine.linkLabel }}<span>↗</span></a></div></div>
          </template>

          <template v-else-if="slide.kind === 'multi-end'">
            <header class="mci-training-slide__heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">{{ slide.chapter }} · MULTI-END DELIVERY</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span></header>
            <div class="mci-device-constellation"><div class="mci-device-core mci-deck-reveal"><img src="/icon.png" alt=""><strong>同一业务底座</strong><small>API · OsClient · DiyToken · Theme</small><i></i></div><article v-for="(device, deviceIndex) in devices" :key="device.code" class="mci-device-node mci-deck-reveal" :style="{ '--mci-device-index': deviceIndex, '--mci-deck-order': deviceIndex }"><span>{{ device.code }}</span><div><strong>{{ device.title }}</strong><small>{{ device.text }}</small></div></article></div>
            <div class="mci-device-links mci-deck-reveal"><a href="/doc/system-engine/multi-end-client.html" target="_blank" rel="noopener noreferrer">全端客户端文档 ↗</a><a href="/doc/system-engine/micro-app.html" target="_blank" rel="noopener noreferrer">前端微服务文档 ↗</a><a href="/doc/system-engine/unity-integration.html" target="_blank" rel="noopener noreferrer">Unity / WebGL 文档 ↗</a></div>
          </template>

          <template v-else-if="slide.kind === 'cases'">
            <div class="mci-case-showcase">
              <div class="mci-case-story">
                <p class="mci-case-kicker mci-deck-reveal"><span></span>成功案例 <i> / </i> 行业实践</p>
                <h2 class="mci-case-title mci-deck-reveal">跨越行业边界<br><strong>让业务价值落地</strong></h2>
                <p class="mci-case-lead mci-deck-reveal">{{ slide.summary }}</p>
                <dl class="mci-case-metrics mci-deck-reveal" aria-label="2018 至 2025 年公开应用数据">
                  <div><dt>已交付软件</dt><dd>200<span>+</span><small>套</small></dd></div>
                  <div><dt>已应用客户</dt><dd>500<span>+</span><small>家</small></dd></div>
                </dl>
                <p class="mci-case-period mci-deck-reveal">2018—2025 · 持续积累的行业实践</p>
              </div>
              <div class="mci-case-coverage">
                <header class="mci-case-coverage__heading mci-deck-reveal"><h3>多元行业，共同选择</h3><span>典型应用场景</span></header>
                <div class="mci-case-industries">
                  <article v-for="(industry, industryIndex) in caseIndustries" :key="industry.title" class="mci-case-industry mci-deck-reveal" :style="{ '--mci-deck-order': industryIndex }">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="industry.icon" /></svg>
                    <h4>{{ industry.title }}</h4>
                    <p>{{ industry.scenes }}</p>
                  </article>
                </div>
              </div>
            </div>
            <footer class="mci-case-footer mci-deck-reveal">
              <p class="mci-case-statement">行业各有不同，<strong>业务落地一脉相通。</strong></p>
              <div class="mci-case-source"><p>数据来源：官网成功案例页（2018—2025）；场景按公开清单归纳。</p><a href="/case/case-index.html" target="_blank" rel="noopener noreferrer">查看案例概览 <span aria-hidden="true">↗</span></a></div>
            </footer>
          </template>

          <template v-else-if="slide.kind === 'closing'">
            <div class="mci-deck-closing"><div class="mci-deck-closing__signal mci-deck-reveal"><i></i><img src="/icon.png" alt="Microi吾码"><span>READY TO BUILD</span></div><p class="mci-deck-eyebrow mci-deck-reveal">THANK YOU · {{ slideMeta.length }} / {{ slideMeta.length }}</p><h2 class="mci-deck-reveal">把 AI 的速度，<br><strong>变成企业交付力。</strong></h2><p class="mci-deck-reveal">从今天开始，少重复造轮子，多创造真正有差异的业务价值。</p><div class="mci-deck-outcomes mci-deck-reveal"><span>开源底座</span><i></i><span>30+ 引擎</span><i></i><span>MCP + Skills</span><i></i><span>全端交付</span><i></i><span>成熟案例</span></div><div class="mci-deck-closing__actions mci-screen-only mci-deck-reveal"><a href="/doc/getting-started/docker-run.html" target="_blank" rel="noopener noreferrer">立即开始使用</a><a href="/doc/" target="_blank" rel="noopener noreferrer">打开官方文档</a></div><small class="mci-deck-reveal">MICROI吾码 · OPEN-SOURCE AI DEVELOPMENT FRAMEWORK</small></div>
          </template>
        </div>
      </section>
    </main>

    <button class="mci-training-deck__edge-nav is-previous mci-screen-only" type="button" :disabled="activeIndex === 0" aria-label="上一页" title="上一页（←）" @click="previousSlide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
    <button class="mci-training-deck__edge-nav is-next mci-screen-only" type="button" :disabled="activeIndex === slideMeta.length - 1" aria-label="下一页" title="下一页（→）" @click="nextSlide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    <footer id="mci-training-controls" class="mci-training-deck__controls mci-screen-only"><div class="mci-training-deck__chapter"><span>{{ currentSlide.chapter }}</span><div><strong>{{ currentSlide.nav }}</strong><small>{{ currentSlide.title }}</small></div></div><div class="mci-training-deck__progress" aria-label="幻灯片进度"><i :style="{ transform: `scaleX(${progress / 100})` }"></i></div><div class="mci-training-deck__counter"><strong>{{ padSlide(activeIndex) }}</strong><span>/ {{ slideMeta.length }}</span></div></footer>
    <div class="mci-training-deck__sr-status" aria-live="polite">第 {{ activeIndex + 1 }} 页，共 {{ slideMeta.length }} 页：{{ currentSlide.title }}</div><Transition name="mci-deck-toast"><div v-if="notice" class="mci-training-deck__toast" role="status">{{ notice }}</div></Transition>
    <div v-if="activePanel" class="mci-training-deck__overlay mci-screen-only" role="presentation" @click.self="closePanel"><section class="mci-training-deck__panel" role="dialog" aria-modal="true" aria-labelledby="mci-deck-help-title"><header><div><p>MICROI PRESENTATION</p><h2 id="mci-deck-help-title">演示操作</h2></div><button ref="panelCloseRef" type="button" aria-label="关闭" @click="closePanel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="mci-training-deck__help"><article><kbd>←</kbd><kbd>→</kbd><span><strong>上一页 / 下一页</strong><small>也支持 ↑ ↓、PageUp / PageDown</small></span></article><article><kbd>Space</kbd><span><strong>继续演示</strong><small>空格键进入下一页</small></span></article><article><kbd>Home</kbd><kbd>End</kbd><span><strong>首尾跳转</strong><small>快速回到封面或致辞页</small></span></article><article><kbd>O</kbd><span><strong>缩略图导航</strong><small>聚焦左侧当前页预览</small></span></article><article><kbd>F11</kbd><span><strong>浏览器全屏</strong><small>Ctrl+F / ⌘F 保留浏览器搜索；左侧可搜索标题和内容</small></span></article><article><kbd>P</kbd><span><strong>下载暗色 PDF</strong><small>顶栏可直接选择暗色或浅色高质量版</small></span></article><article><span class="mci-training-deck__gesture">↔</span><span><strong>鼠标 / 触控</strong><small>滚轮、两侧按钮或横向拖动切页</small></span></article><article><span class="mci-training-deck__gesture">↗</span><span><strong>现场讲解</strong><small>所有功能入口均在新窗口打开官方文档</small></span></article></div></section></div>
  </div>
</template>
