import { trainingCaseAssets } from './training-case-assets.js'

// 企业版按真实交付案例组织；前三页和致辞复用技术版组件，避免两份优势文案漂移。
const definitions = [
  { id:'enterprise-opening', nav:'企业版开场', commonKind:'cover', title:'Microi吾码 AI 开发框架', summary:'以成功案例为路线，现场了解平台、行业实践与企业交付。' },
  { id:'enterprise-framework', nav:'框架/系统架构重要性', commonKind:'decision', title:'企业研发，为什么要先选一套开源 AI 开发框架？', summary:'选对成熟系统底座，让 AI 的开发速度成为可持续的产品能力。' },
  { id:'enterprise-why', nav:'为什么选择吾码？', commonKind:'why', title:'为什么选择吾码？', summary:'AI 原生、企业级、全生命周期——通用能力复用，业务灵活生长。' },
  { id:'enterprise-case-overview', nav:'成功案例总览', layout:'overview', title:'看见行业，才看见平台的可能', summary:'从上千人工厂到数字世界，同一套系统底座承接不同业务。', eyebrow:'04 / INDUSTRY IN ACTION',
    cards:[
      {title:'大型MES',text:'中大型工厂与上市公司 · 15+ MES交付',label:'01 / MANUFACTURING',target:4,glyph:'MES',accent:'cyan'},
      {title:'数字孪生/IoT物联网',text:'AI建模 · 三维场景 · 实时设备通信',label:'02 / DIGITAL TWIN',target:5,glyph:'3D',accent:'blue'},
      {title:'OA/ERP',text:'国企与集团办公 · 100余家服装工厂',label:'03 / OPERATIONS',target:6,glyph:'ERP',accent:'green'},
      {title:'游戏',text:'玩家数据管理 · 实时通信 · 商用交付',label:'04 / INTERACTIVE',target:7,glyph:'PLAY',accent:'purple'},
      {title:'更多成功案例',text:'500余套软件 · 跨行业持续应用',label:'05 / BEYOND',target:8,glyph:'500+',accent:'amber'},
    ], takeaway:'点击行业，直接进入对应案例；也可使用底部上一页、下一页逐页介绍。' },
  { id:'enterprise-mes', nav:'大型MES', layout:'case', group:'mes', title:'大型MES，走进上千人工厂', summary:'已交付中大型工厂、上市公司MES 15+；让计划、执行与追溯在同一平台闭环。', eyebrow:'05 / MANUFACTURING EXECUTION', metric:'15+',metricLabel:'中大型工厂 / 上市公司MES交付',
    cards:[
      {title:'从订单到现场',text:'工艺流程 · 采购协同 · 计划排产（APS）· 生产派工 · 车间管理 · BOM'},
      {title:'从质量到资源',text:'质量管理 · 仓储管理 · 设备管理 · 设备机联 · 模具管理 · 能耗管理'},
      {title:'从执行到经营',text:'计件工资 · 全链路追溯 · 报表看板 · 移动端现场流程办公 · 蓝牙打印'},
      {title:'系统打通，持续调整',text:'第三方 ERP 流程对接打通；实施、交付人员可在线调整业务配置。'},
    ],takeaway:'业务发生变化，实施与交付人员在线调整，让工业软件持续贴合工厂。' },
  { id:'enterprise-iot', nav:'数字孪生/IoT物联网', layout:'case', group:'iot', title:'从真实现场，到实时数字世界', summary:'AI驱动场景构建，30+引擎驱动业务，IoT实时通信连接设备与运营。', eyebrow:'06 / DIGITAL TWIN & IOT', metric:'AI + 3D',metricLabel:'照片 / 视频 → AI建模 → 三维呈现',
    cards:[
      {title:'前端呈现',text:'AI + Blender / CAD / 3ds Max + Three.js / Unity，构建数字孪生与交互场景。'},
      {title:'照片、视频直接起步',text:'无需人工从零绘图、建模，只需照片 / 视频完成AI建模，再按现场精度与交付要求校验。'},
      {title:'实时设备通信',text:'后端由系统架构30+引擎驱动；IoT支持Socket、MQTT、TCP透传等多种实时通信方式。'},
      {title:'现场设备与网关',text:'采用主流Zigbee、RS-485等通信方式，支持Modbus等协议，连接物理现场。'},
    ],takeaway:'场景、设备、数据与业务流程，进入同一条实时链路。' },
  { id:'enterprise-oaerp', nav:'OA/ERP', layout:'case', group:'oaerp', title:'组织协同与行业经营，一体贯通', summary:'多家国企、集团公司OA办公系统，以及服装、电器和轻量级ERP实践。', eyebrow:'07 / OFFICE & ENTERPRISE RESOURCE', metric:'100余家',metricLabel:'慈溪服装工厂已应用 · SaaS引擎模式',
    cards:[
      {title:'国企与集团OA',text:'已应用于多家国企、集团公司，承接日常办公、流程审批与跨岗位协同。'},
      {title:'服装ERP',text:'慈溪服装工厂已应用100余家，基于SaaS引擎模式，复用行业能力并保持租户隔离。'},
      {title:'电器ERP',text:'面向电器行业的订单、采购、生产与经营流程，根据实际业务持续扩展。'},
      {title:'轻量级ERP',text:'从核心经营流程起步，随企业规模与管理深度逐步生长。'},
    ],takeaway:'一套成熟底座，既承接集团协同，也服务行业化SaaS。' },
  { id:'enterprise-games', nav:'游戏', layout:'case', group:'games', title:'让游戏创意，快速进入可交付产品', summary:'吾码系统架构非常适合游戏服务器端的玩家数据管理与实时通信。', eyebrow:'08 / GAME BACKEND & REALTIME', metric:'几天',metricLabel:'范围明确的类CS / 棋牌游戏交付周期',
    cards:[
      {title:'玩家数据管理',text:'以成熟系统架构管理玩家账号、业务数据与运营后台。'},
      {title:'实时通信技术',text:'连接游戏客户端与服务端，支撑实时消息和互动业务。'},
      {title:'快速商业交付',text:'复用系统架构与现成能力，范围明确的类CS、棋牌游戏可在几天内开发为可商用交付产品。'},
    ],takeaway:'把时间留给玩法与体验；实际周期随玩法、素材、联机规模和验收范围变化。' },
  { id:'enterprise-more', nav:'更多成功案例', layout:'universe', group:'more', title:'跨越行业边界，连接更多可能', summary:'吾码在其它领域共计交付500余套软件，持续把业务想法变成真实系统。', eyebrow:'09 / ONE PLATFORM · MANY WORLDS', metric:'500+',metricLabel:'其它领域软件交付',
    sectors:['CRM客户关系','CMS内容管理','B2C商城','酒店管理','财税服务','考试系统','售后系统','企业服务平台','商会管理','互联网平台','园区与公共服务','物流与供应链','教育教务','农业牧场','资产管理'],
    takeaway:'对某个领域感兴趣？欢迎联系我们参观更多成功案例，与我们一起深入了解实际业务。',sources:[{label:'参观成功案例',href:'/case/case-index.html'},{label:'联系吾码',href:'/contact/'}] },
  { id:'enterprise-closing', nav:'致辞', commonKind:'closing', title:'把 AI 的速度，变成企业可持续交付力', summary:'从今天开始，少重复造轮子，多创造真正有差异的业务价值。' },
]

export const enterpriseSlides = definitions.map((slide,index)=>({
  ...slide, chapter:String(index+1).padStart(2,'0'),kind:'enterprise',
  commonKind:slide.commonKind||'',layout:slide.layout||'common',eyebrow:slide.eyebrow||'',
  lead:'',cards:slide.cards||[],steps:[],metrics:[],image:null,sources:slide.sources||[],takeaway:slide.takeaway||'',sectors:slide.sectors||[],
  metric:slide.metric||'',metricLabel:slide.metricLabel||'',
  gallery:trainingCaseAssets.filter(asset=>asset.group===slide.group),
}))
export const enterpriseSlideCount=10
export const enterpriseSections=[
  {id:'enterprise-platform',title:'平台与选型',slideIds:definitions.slice(0,3).map(s=>s.id)},
  {id:'enterprise-cases',title:'成功案例',slideIds:definitions.slice(3,9).map(s=>s.id)},
  {id:'enterprise-closing',title:'致辞',slideIds:['enterprise-closing']},
]
if(enterpriseSlides.length!==enterpriseSlideCount)throw new Error('企业版必须包含10页')
