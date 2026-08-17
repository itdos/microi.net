import appConfig from '@/config.js'

const asset = (path) => `/static/xjy/${path}`

export const businessGroups = [
  {
    key: 'customer',
    title: '客户管理',
    subtitle: '客户、联系人、拜访与成交线索',
    accent: '#0B86D4',
    items: [
      { key: 'customers', title: '我的客户', icon: asset('business/kehu.png') },
      { key: 'contacts', title: '联系人', icon: asset('business/lianxiren.png') },
      { key: 'visits', title: '跟进记录', icon: asset('business/baifang.png') },
      { key: 'performance', title: '业绩统计', icon: asset('business/yeji.png') },
      { key: 'cases', title: '客户案例', icon: asset('business/anlice.png') },
      { key: 'casebooks', title: '案例册', icon: asset('business/anlice.png') },
      { key: 'proposals', title: '需求方案', icon: asset('business/shenqing.png') },
      { key: 'customerCare', title: '客户关怀', icon: asset('business/tixing.png') },
      { key: 'customerMap', title: '客户地图', icon: asset('business/customerMap.png') },
      { key: 'contactMap', title: '联系人地图', icon: asset('business/dw.png') },
      { key: 'visitMap', title: '跟进地图', icon: asset('business/baifang.png') }
    ]
  },
  {
    key: 'service',
    title: '服务管理',
    subtitle: '合同订单、设备与售后任务',
    accent: '#E94B2C',
    items: [
      { key: 'cooperativeCustomers', title: '合作客户', icon: asset('business/kehu.png') },
      { key: 'orders', title: '我的订单', icon: asset('business/dingdan.png') },
      { key: 'tasks', title: '我的任务', icon: asset('repair/renwu.png'), badgeKey: 'task' },
      { key: 'devices', title: '我的设备', icon: asset('business/shebei.png') },
      { key: 'filters', title: '滤芯统计', icon: asset('business/lvxin.png') },
      { key: 'areas', title: '片区管理', icon: asset('business/area.png') },
      { key: 'afterSalesAdd', title: '我要售后', icon: asset('business/sh.png') },
      { key: 'serviceRecords', title: '售后服务记录', icon: asset('business/fwjllb.png') },
      { key: 'serviceForms', title: '客户服务记录表', icon: asset('business/fwjllb.png') },
      { key: 'taskScan', title: '扫码做任务', icon: appConfig.cdnAssets.scan },
      { key: 'deviceMap', title: '设备地图', icon: asset('business/eqpMap.png') },
      { key: 'orderGoods', title: '订单商品', icon: asset('business/goods.png') },
      { key: 'installationPositions', title: '安装位置', icon: asset('business/dw.png') },
      { key: 'orderCommissions', title: '订单分佣', icon: asset('business/shouyi.png') },
      { key: 'consumableArchives', title: '订单耗材', icon: asset('business/lvxin.png') }
    ]
  },
  {
    key: 'oa',
    title: '内部协同',
    subtitle: '组织协作、打卡与供应链',
    accent: '#1F9D72',
    items: [
      { key: 'stores', title: '商家', icon: asset('business/sj.png') },
      { key: 'suppliers', title: '供应商', icon: asset('business/goods.png') },
      { key: 'directory', title: '通讯录', icon: asset('repair/tongxunlu.png') },
      { key: 'attendance', title: '拜访打卡', icon: asset('business/dw.png') },
      { key: 'attendanceRecords', title: '打卡记录', icon: asset('business/checkRecord.png') },
      { key: 'members', title: '成员管理', icon: asset('repair/tongxunlu.png') },
      { key: 'recruitment', title: '应聘档案', icon: asset('business/yingpin.png') },
      { key: 'applicantFamily', title: '家庭背景', icon: asset('business/yingpin.png') },
      { key: 'applicantEducation', title: '教育经历', icon: asset('business/yingpin.png') },
      { key: 'applicantWork', title: '工作经历', icon: asset('business/yingpin.png') },
      { key: 'applicantCertificates', title: '专业证书', icon: asset('business/yingpin.png') }
    ]
  },
  {
    key: 'opportunity',
    title: '需求与商机',
    subtitle: '从线索到项目协作',
    accent: '#7556C8',
    items: [
      { key: 'leads', title: '线索', icon: asset('business/xiansuo.png') },
      { key: 'opportunities', title: '商机', icon: asset('business/shouyi.png') },
      { key: 'partners', title: '项目合伙人', icon: asset('business/xiezuo.png') },
      { key: 'demands', title: '需求发布', icon: asset('business/xuqiu.png') },
      { key: 'demandResponses', title: '需求响应', icon: asset('business/xuqiu.png') },
      { key: 'leadVisits', title: '线索跟进', icon: asset('business/baifang.png') }
    ]
  }
]

const native = (config) => ({ target: 'native-list', pageSize: 15, ...config })

const yesNoOptions = [{ label: '是', value: 1 }, { label: '否', value: 0 }]
const customerSortOptions = [
  { label: '预期金额从高到低', value: 'amount-desc', field: 'YuqiJYJE', order: 'DESC' },
  { label: '预期金额从低到高', value: 'amount-asc', field: 'YuqiJYJE', order: 'ASC' },
  { label: '预期交易时间较近', value: 'trade-asc', field: 'YuqiJYSJ', order: 'ASC' },
  { label: '预期交易时间较远', value: 'trade-desc', field: 'YuqiJYSJ', order: 'DESC' },
  { label: '下次拜访时间较近', value: 'visit-asc', field: 'XiaciGJRQ', order: 'ASC' },
  { label: '下次拜访时间较远', value: 'visit-desc', field: 'XiaciGJRQ', order: 'DESC' }
]
const customerFilterFields = [
  { key: 'customerType', label: '客户类型', field: 'KehuLX', type: 'options', multiple: true, source: 'baseData', parentKey: 'KehuLX', valueField: 'Value', labelField: 'Value' },
  { key: 'customerState', label: '客户状态', field: 'Zhuangtai', type: 'options', multiple: true, source: 'baseData', parentKey: 'KehuZT', valueField: 'Value', labelField: 'Value' },
  { key: 'followState', label: '客户跟进状态', field: 'KehuGJZT', type: 'options', multiple: true, source: 'baseData', parentKey: 'GenjinZT', valueField: 'Value', labelField: 'Value' },
  { key: 'expansion', label: '新建扩建项目', field: 'XinjianKJXM', type: 'options', options: yesNoOptions },
  { key: 'major', label: '重大项目', field: 'ShifouZDXM', type: 'options', options: yesNoOptions },
  { key: 'area', label: '所属片区', field: 'SuoshuPQ', type: 'options', source: 'table', table: 'diy_area', valueField: 'PianquMC', labelField: 'PianquMC', orderBy: 'Paixu', orderType: 'ASC' },
  { key: 'city', label: '城市', field: 'Chengshi', type: 'text', placeholder: '输入省、市或区县' },
  { key: 'owner', label: '负责人', field: 'FuzeR', type: 'text' },
  { key: 'collaborator', label: '协作人', field: 'XiezuoR', type: 'text' },
  { key: 'partner', label: '项目合伙人', field: 'WaibuXZR', type: 'text' },
  { key: 'creator', label: '创建人', field: 'UserName', type: 'text' },
  { key: 'ownTenant', label: '数据范围', field: 'TenantId', type: 'toggle', currentUserField: 'TenantId', description: '只看本商家客户' },
  { key: 'customerSort', label: '排序方式', type: 'sort', options: customerSortOptions }
]
const visitFilterFields = [
  { key: 'visitType', label: '跟进方式', field: 'GenjinFS', type: 'options', multiple: true, source: 'baseData', parentKey: 'GenjinFS', valueField: 'Value', labelField: 'Value' },
  { key: 'customerState', label: '客户合作状态', field: 'KehuHZZT', type: 'options', multiple: true, source: 'baseData', parentKey: 'KehuZT', valueField: 'Value', labelField: 'Value' },
  { key: 'targetType', label: '拜访对象类型', field: 'BaifangDXLX', type: 'options', options: [
    { label: '客户', value: '客户' },
    { label: '项目合伙人', value: '项目合伙人' },
    { label: '供应商', value: '供应商' },
    { label: '商家', value: '商家' }
  ] },
  { key: 'target', label: '拜访对象', field: 'KehuMC', type: 'text' },
  { key: 'visitor', label: '跟进人', field: 'BaifangR', type: 'text' },
  { key: 'approval', label: '审批状态', field: 'ShenpiZT', type: 'text' },
  { key: 'visitSort', label: '排序方式', type: 'sort', options: [
    { label: '最近跟进', value: 'visit-desc', field: 'GenjinSJ', order: 'DESC' },
    { label: '最早跟进', value: 'visit-asc', field: 'GenjinSJ', order: 'ASC' },
    { label: '下次跟进较近', value: 'next-asc', field: 'XiaciGJRQ', order: 'ASC' }
  ] }
]

export const businessModules = {
  customers: native({
    title: '我的客户', table: 'Diy_Kehu', menuAliases: ['客户', '客户管理', '我的客户'],
    titleField: 'KehuMC', statusField: 'Zhuangtai', tagFields: ['KehuLX', 'KehuGJZT'],
    lines: [
      { label: '负责人', field: 'FuzeR' },
      { label: '所在城市', field: 'Chengshi', format: 'region' },
      { label: '下次跟进', field: 'XiaciGJRQ', format: 'datetime' }
    ],
    statisticsField: 'YuqiJYJE', statisticsLabel: '预期交易额', defaultOrderBy: 'CreateTime',
    statusOptions: ['目标客户', '意向客户', '合作客户', '断约客户', '非目标客户'],
    filterFields: customerFilterFields
  }),
  cooperativeCustomers: native({
    title: '合作客户', table: 'Diy_Kehu', menuAliases: ['合作客户', '客户'],
    titleField: 'KehuMC', statusField: 'Zhuangtai', tagFields: ['KehuLX'],
    fixedWhere: [{ Name: 'Zhuangtai', Type: 'Like', Value: '合作' }],
    lines: [
      { label: '负责人', field: 'FuzeR' },
      { label: '所在城市', field: 'Chengshi', format: 'region' },
      { label: '所属商家', field: 'TenantName' }
    ],
    filterFields: customerFilterFields
  }),
  customerAddresses: native({
    title: '客户地址', table: 'diy_kehudz', menuAliases: ['客户地址'],
    titleField: 'XiangxiDZ', statusField: 'IsMainAddress', tagFields: [],
    lines: [
      { label: '所在城市', field: 'Chengshi', format: 'region' },
      { label: '详细地址', field: 'XiangxiDZ' },
      { label: '创建时间', field: 'CreateTime', format: 'datetime' }
    ]
  }),
  contacts: native({
    title: '联系人', table: 'Diy_LianxiR', menuAliases: ['联系人', '客户联系人'],
    titleField: 'Xingming', statusField: 'GuanjianJCR', tagFields: ['Bumen', 'Zhiwu'],
    phoneField: 'ShoujiH',
    relatedMetrics: [
      { key: 'active', label: '在职', where: [{ Name: 'ZhiweiZT', Type: '=', Value: '在职' }], tone: 'warning' },
      { key: 'month', label: '本月联系人', monthField: 'CreateTime', tone: 'primary' },
      { key: 'total', label: '联系人总量', tone: 'neutral' }
    ],
    lines: [
      { label: '联系电话', field: 'ShoujiH', format: 'phone' },
      { label: '所属客户', field: 'SuoshuKH' },
      { label: '创建人', field: 'UserName' }
    ],
    filterFields: [
      { key: 'customer', label: '所属客户', field: 'SuoshuKH', type: 'text' },
      { key: 'department', label: '部门', field: 'Bumen', type: 'text' },
      { key: 'position', label: '职务', field: 'Zhiwu', type: 'text' },
      { key: 'decisionMaker', label: '关键决策人', field: 'GuanjianJCR', type: 'options', options: yesNoOptions }
    ]
  }),
  visits: native({
    title: '跟进记录', table: 'Diy_GenjinJL', menuAliases: ['跟进记录', '拜访记录'],
    titleField: 'KehuMC', statusField: 'GenjinFS', tagFields: ['ShenpiZT', 'BaifangDXLX'],
    relatedMetrics: [
      { key: 'valid', label: '有效跟进', where: [{ Name: 'GuanjianJCR', Type: '=', Value: 1 }], tone: 'success' },
      { key: 'month', label: '本月跟进', monthField: 'GenjinSJ', tone: 'primary' },
      { key: 'total', label: '跟进总量', tone: 'neutral' }
    ],
    lines: [
      { label: '拜访对象', field: 'KehuMC' },
      { label: '跟进人', field: 'BaifangR' },
      { label: '跟进时间', field: 'GenjinSJ', format: 'datetime' },
      { label: '下次跟进', field: 'XiaciGJRQ', format: 'datetime' }
    ],
    // zhy：列表最多 3 行并显示省略号，详情最多 11 行后纵向滚动。
    summaryField: 'GenjinJL', summaryLines: 3, detailSummaryLines: 11, periodField: 'GenjinSJ', filterFields: visitFilterFields
  }),
  orders: native({
    title: '合同订单', table: 'Diy_Dingdan', menuAliases: ['合同订单', '订单管理', '我的订单'],
    titleField: 'DingdanBH', statusField: 'DingdanZT', tagFields: ['XinLDD', 'DingdanHZFS'],
    fixedWhere: [{ Name: 'DingdanZT', Type: '!=', Value: '已作废' }],
    relatedMetrics: [
      { key: 'pending', label: '待审批', where: [{ Name: 'DingdanZT', Type: '=', Value: '待审批' }], tone: 'warning' },
      { key: 'approved', label: '已审批', where: [{ Name: 'DingdanZT', Type: '=', Value: '已审批' }], tone: 'success' },
      { key: 'amount', label: '订单总额', aggregateField: 'DingdanJE', format: 'compactMoney', tone: 'primary' },
      { key: 'month', label: '本月订单', monthField: 'CreateTime', tone: 'neutral' }
    ],
    lines: [
      { label: '客户名称', field: 'KehuMC' },
      { label: '订单金额', field: 'DingdanJE', format: 'money' },
      { label: '创建人', field: 'UserName' }
    ],
    statisticsField: 'DingdanJE', statisticsLabel: '订单金额',
    statusOptions: ['待审批', '已审批', '已驳回', '待审批作废'],
    filterFields: [
      { key: 'customerType', label: '新老客户订单', field: 'XinLDD', type: 'options', multiple: true, options: [
        { label: '老客户续签订单', value: '老客户续签订单' }, { label: '老客户新增订单', value: '老客户新增订单' },
        { label: '老客户合并订单', value: '老客户合并订单' }, { label: '新客户订单', value: '新客户订单' },
        { label: '老客户补录订单', value: '老客户补录订单' }
      ] },
      { key: 'cooperation', label: '合作方式', field: 'DingdanHZFS', type: 'options', multiple: true, source: 'baseData', parentKey: 'DingDanHZFS', valueField: 'Value', labelField: 'Value' },
      { key: 'amount', label: '订单金额区间', field: 'DingdanJE', type: 'range', minPlaceholder: '最低金额', maxPlaceholder: '最高金额' },
      { key: 'customer', label: '客户名称', field: 'KehuMC', type: 'text' },
      { key: 'creator', label: '创建人', field: 'UserName', type: 'text' },
      { key: 'mine', label: '数据范围', field: 'UserId', type: 'toggle', currentUserField: 'Id', description: '只看我创建的订单' },
      { key: 'orderSort', label: '排序方式', type: 'sort', options: [
        { label: '订单金额从高到低', value: 'amount-desc', field: 'DingdanJE', order: 'DESC' },
        { label: '订单金额从低到高', value: 'amount-asc', field: 'DingdanJE', order: 'ASC' },
        { label: '最新创建', value: 'create-desc', field: 'CreateTime', order: 'DESC' },
        { label: '最早创建', value: 'create-asc', field: 'CreateTime', order: 'ASC' }
      ] }
    ]
  }),
  tasks: {
    target: 'task-list',
    title: '售后任务', table: 'Diy_ShouhouDD', menuAliases: ['售后订单', '售后任务', '我的任务'],
    titleField: 'ShouhouFWBH', statusField: 'Zhuangtai', tagFields: ['Leixing'],
    relatedMetrics: [
      { key: 'action', label: '进行中', where: [{ Name: 'Zhuangtai', Type: 'In', Value: ['待指派', '待接单', '待服务', '待完成', '待验收', '待评论', '待商家验收', '待客户验收'] }], tone: 'warning' },
      { key: 'positive', label: '已完结', where: [{ Name: 'Zhuangtai', Type: 'In', Value: ['已完结'] }], tone: 'success' },
      { key: 'amount', label: '应收金额合计', aggregateField: 'ShouhouFY', format: 'compactMoney', tone: 'primary' },
      { key: 'month', label: '本月售后任务', monthField: 'YujiSHSJ', tone: 'primary' }
    ],
    lines: [
      { label: '客户名称', field: 'KehuMC' },
      { label: '计划服务', field: 'YujiSHSJ', format: 'datetime' },
      { label: '服务人员', field: 'ShouhouRY' }
    ],
    summaryField: 'Neirong', defaultOrderBy: 'YujiSHSJ', defaultOrderType: 'ASC',
    statusOptions: ['待接单', '待服务', '待商家验收', '待客户验收', '待评价', '已结束', '已取消']
  },
  devices: native({
    title: '客户设备', table: 'Diy_KehuSB', menuAliases: ['客户设备', '我的设备', '设备管理'],
    titleField: 'KehuMC', statusField: 'ShebeiZT', tagFields: ['ShebeiXH', 'ShebeiGZZT'],
    relatedMetrics: [
      { key: 'pending', label: '待安装', where: [{ Name: 'ShebeiZT', Type: '=', Value: '待安装' }], tone: 'warning' },
      { key: 'active', label: '使用中', where: [{ Name: 'ShebeiZT', Type: '=', Value: '使用中' }], tone: 'success' },
      { key: 'month', label: '本月设备', monthField: 'CreateTime', tone: 'primary' },
      { key: 'total', label: '设备总量', tone: 'neutral' }
    ],
    lines: [
      { label: '设备编号', field: 'ShebeiBH' },
      { label: '安装位置', field: 'AnzhuangWZ' },
      { label: '所属商家', field: 'TenantName' }
    ],
    statusOptions: ['待安装', '使用中', '库存中', '已退机', '已报废', '已报废换新'],
    filterFields: [
      { key: 'state', label: '设备状态', field: 'ShebeiZT', type: 'options', multiple: true, source: 'baseData', parentKey: 'ShenbeiZT', valueField: 'Value', labelField: 'Value' },
      { key: 'model', label: '设备型号', field: 'ShebeiXH', type: 'text' },
      { key: 'position', label: '安装位置', field: 'AnzhuangWZ', type: 'text' },
      { key: 'brand', label: '设备品牌', field: 'ShangpinMC', type: 'text' },
      { key: 'customer', label: '客户名称', field: 'KehuMC', type: 'text' },
      { key: 'tenant', label: '所属商家', field: 'TenantName', type: 'text' },
      { key: 'deviceSort', label: '排序方式', type: 'sort', options: [
        { label: '最新建档', value: 'create-desc', field: 'CreateTime', order: 'DESC' },
        { label: '服务开始时间较近', value: 'service-start', field: 'FuwuKSSJ', order: 'ASC' },
        { label: '服务结束时间较近', value: 'service-end', field: 'FuwuJSSJ', order: 'ASC' }
      ] }
    ]
  }),
  serviceRecords: native({
    title: '服务记录', table: 'Diy_ShouhouDD', menuAliases: ['服务记录表', '服务记录', '售后订单'],
    titleField: 'ShouhouFWBH', statusField: 'Zhuangtai', tagFields: ['Leixing'],
    lines: [
      { label: '客户名称', field: 'KehuMC' },
      { label: '完成时间', field: 'FinishTime', format: 'datetime' },
      { label: '服务人员', field: 'ShouhouRY' }
    ],
    fixedWhere: [{ Name: 'Zhuangtai', Type: 'In', Value: ['已结束', '已完成'] }]
  }),
  taskDevices: native({
    title: '设备服务记录', table: 'diy_shouhousp', menuAliases: ['售后设备', '售后商品'],
    titleField: 'ShebeiMC', statusField: 'FuwuZT', tagFields: ['FuwuLX', 'ShebeiXH'],
    lines: [{ label: '设备编号', field: 'ShebeiBH' }, { label: '安装位置', field: 'AnzhuangWZ' }, { label: '订单编号', field: 'DingdanBH' }]
  }),
  serviceForms: native({
    title: '客户服务记录表', table: 'diy_ServiceRecord', menuAliases: ['服务记录表', '客户服务记录'],
    titleField: 'KehuMC', tagFields: ['FuwuXM'],
    relatedMetrics: [
      { key: 'month', label: '本月服务', monthField: 'KaishiSJ', tone: 'primary' },
      { key: 'quality', label: '信息已完善', where: [{ Name: 'FuwuJLBSJ', Type: '<>', Value: '' }], tone: 'success' },
      { key: 'total', label: '服务总量', tone: 'neutral' }
    ],
    lines: [{ label: '开始时间', field: 'KaishiSJ', format: 'datetime' }, { label: '结束时间', field: 'JieshuSJ', format: 'datetime' }, { label: '创建人', field: 'UserName' }]
  }),
  filters: native({
    title: '滤芯统计', table: 'diy_huanxinlb', menuAliases: ['滤芯统计', '换芯列表'],
    titleField: 'KehuMC', tagFields: ['ShebeiXH', 'LvxinXH'],
    lines: [
      { label: '设备名称', field: 'ShebeiMC' },
      { label: '计划服务', field: 'YujiFWSJ', format: 'datetime' },
      { label: '滤芯名称', field: 'LvxinMC' },
      { label: '数量', field: 'Shuliang' }
    ]
  }),
  areas: native({
    title: '片区管理', table: 'diy_area', menuAliases: ['片区管理', '服务片区'],
    titleField: 'PianquMC', tagFields: ['SuoshuSSQ', 'PianquFW'],
    lines: [
      { label: '负责人', field: 'FuzeR' },
      { label: '所属商家', field: 'TenantName' },
      { label: '更新时间', field: 'UpdateTime', format: 'datetime' }
    ]
  }),
  stores: native({
    title: '商家', table: 'Diy_Tenant', menuAliases: ['商家列表', '商家', '商家管理'],
    titleField: 'TenantName', statusField: 'Zhuangtai', tagFields: ['SuoshuHY'],
    lines: [
      { label: '联系人', field: 'LianxiR' },
      { label: '联系电话', field: 'LianxiRDH', format: 'phone' },
      { label: '所在城市', field: 'Chengshi', format: 'region' }
    ]
  }),
  merchantProducts: native({
    title: '商家商品', table: 'Diy_Shangpin', menuAliases: ['商品列表', '商品管理'],
    titleField: 'ShangpinMC', statusField: 'Zhuangtai', tagFields: ['ShangpinLX', 'ShangpinBH'],
    lines: [{ label: '现价', field: 'Xianjia', format: 'money' }, { label: '所属商家', field: 'TenantName' }, { label: '更新时间', field: 'UpdateTime', format: 'datetime' }]
  }),
  suppliers: native({
    title: '供应商', table: 'Diy_ShangpinGYS', menuAliases: ['供应商', '商品供应商'],
    titleField: 'Mingcheng', statusField: 'Zhuangtai', tagFields: ['Biaoqian'],
    lines: [
      { label: '联系人', field: 'ShoujiHXM' },
      { label: '联系电话', field: 'LianxiDH', format: 'phone' },
      { label: '所在城市', field: 'Chengshi', format: 'region' }
    ]
  }),
  leads: native({
    title: '线索', table: 'Diy_Xiansuo', menuAliases: ['线索', '线索管理'],
    titleField: 'XiansuoMC', statusField: 'Zhuangtai', tagFields: ['XiansuoLY'],
    lines: [
      { label: '联系人', field: 'LianxiR' },
      { label: '联系电话', field: 'ShoujiH', format: 'phone' },
      { label: '负责人', field: 'FuzeR' }
    ],
    filterFields: [
      { key: 'source', label: '线索来源', field: 'XiansuoLY', type: 'text' },
      { key: 'state', label: '线索状态', field: 'Zhuangtai', type: 'text' },
      { key: 'owner', label: '负责人', field: 'FuzeR', type: 'text' },
      { key: 'mine', label: '数据范围', field: 'FuzeRID', type: 'toggle', currentUserField: 'Id', description: '只看我负责的线索' }
    ]
  }),
  leadVisits: native({
    title: '线索跟进', table: 'Diy_XiansuoGJJL', menuAliases: ['线索跟进', '线索跟进记录'],
    titleField: 'XiansuoMC', statusField: 'GenjinFS', tagFields: ['GenjinFS'],
    lines: [
      { label: '跟进人', field: 'UserName' },
      { label: '跟进时间', field: 'GenjinSJ', format: 'datetime' },
      { label: '下次跟进', field: 'XiaciGJRQ', format: 'datetime' }
    ],
    // zhy：线索跟进沿用相同的长文本展示规则。
    summaryField: 'GenjinJL', summaryLines: 3, detailSummaryLines: 11, periodField: 'GenjinSJ',
    filterFields: [
      { key: 'visitType', label: '跟进方式', field: 'GenjinFS', type: 'options', multiple: true, source: 'baseData', parentKey: 'GenjinFS', valueField: 'Value', labelField: 'Value' },
      { key: 'visitor', label: '跟进人', field: 'UserName', type: 'text' },
      { key: 'lead', label: '线索名称', field: 'XiansuoMC', type: 'text' }
    ]
  }),
  opportunities: native({
    title: '商机', table: 'Diy_Shangji', menuAliases: ['商机', '商机管理'],
    titleField: 'Biaoti', tagFields: ['ZhongyaoCD'],
    relatedMetrics: [
      { key: 'amount', label: '预计金额合计', aggregateField: 'YujiJE', format: 'compactMoney', tone: 'primary' },
      { key: 'month', label: '本月商机', monthField: 'YujiHZSJ', tone: 'primary' },
      { key: 'total', label: '商机总量', tone: 'neutral' }
    ],
    lines: [
      { label: '客户名称', field: 'Kehu' },
      { label: '预计金额', field: 'YujiJE', format: 'money' },
      { label: '负责人', field: 'FuzeR' }
    ],
    statisticsField: 'YujiJE', statisticsLabel: '预计金额',
    filterFields: [
      { key: 'importance', label: '重要程度', field: 'ZhongyaoCD', type: 'text' },
      { key: 'customer', label: '客户名称', field: 'Kehu', type: 'text' },
      { key: 'owner', label: '负责人', field: 'FuzeR', type: 'text' },
      { key: 'amount', label: '预计金额区间', field: 'YujiJE', type: 'range' },
      { key: 'mine', label: '数据范围', field: 'FuzeRID', type: 'toggle', currentUserField: 'Id', description: '只看我负责的商机' }
    ]
  }),
  partners: native({
    title: '项目合伙人', table: 'diy_waibuxzr', menuAliases: ['项目合伙人', '外部协作人'],
    titleField: 'Xingming', statusField: 'ZhiweiZT', tagFields: ['Biaoqian'],
    lines: [
      { label: '联系电话', field: 'Dianhua', format: 'phone' },
      { label: '单位名称', field: 'DanweiMC' },
      { label: '创建时间', field: 'CreateTime', format: 'datetime' }
    ]
  }),
  demands: native({
    title: '需求发布', table: 'diy_NeedRelease', menuAliases: ['需求发布', '需求管理'],
    titleField: 'Xuqiu', tagFields: ['ZhidingHY', 'SuoshuPQ'],
    lines: [
      { label: '发布人', field: 'FabuR' },
      { label: '地区', field: 'Diqu' },
      { label: '创建时间', field: 'CreateTime', format: 'datetime' }
    ],
    summaryField: 'XuqiuNR',
    filterFields: [
      { key: 'industry', label: '指定行业', field: 'ZhidingHY', type: 'text' },
      { key: 'area', label: '所属片区', field: 'SuoshuPQ', type: 'text' },
      { key: 'region', label: '地区', field: 'Diqu', type: 'text' },
      { key: 'publisher', label: '发布人', field: 'FabuR', type: 'text' },
      { key: 'mine', label: '数据范围', field: 'FabuRID', type: 'toggle', currentUserField: 'Id', description: '只看我发布的需求' }
    ]
  }),
  proposals: native({
    title: '客户方案', table: 'Diy_kehufaxx', menuAliases: ['客户方案', '方案管理'],
    titleField: 'FanganMC', tagFields: ['YujiHZSJ'],
    relatedMetrics: [
      { key: 'positions', label: '场所点位数量合计', aggregateField: 'ChangsuoDWSL', tone: 'primary' },
      { key: 'month', label: '本月客户方案', monthField: 'YujiHZSJ', tone: 'primary' },
      { key: 'total', label: '方案总量', tone: 'neutral' }
    ],
    lines: [{ label: '预计合作', field: 'YujiHZSJ', format: 'date' }]
  }),
  customerCare: native({
    title: '客户关怀', table: 'Diy_kehuguanhuai', menuAliases: ['客户关怀', '关怀记录'],
    titleField: 'KehuMC', tagFields: ['ZengliXQ'],
    lines: [{ label: '联系人', field: 'LianxiR' }, { label: '物品', field: 'ZengliXQ' }, { label: '总价', field: 'Zongjia', format: 'money' }]
  }),
  orderGoods: native({
    title: '订单商品', table: 'Diy_DingdanSP', menuAliases: ['订单商品', '合同商品'],
    titleField: 'ShangpinMC', statusField: 'HezuoZT', tagFields: ['HezuoFS', 'ShebeiBH'],
    lines: [{ label: '设备编号', field: 'ShebeiBH' }, { label: '数量', field: 'Shuliang' }, { label: '实际价格', field: 'ShijiJG', format: 'money' }]
  }),
  installationPositions: native({
    title: '安装位置', table: 'diy_shebeiwz', menuAliases: ['安装位置', '订单商品安装位置'],
    titleField: 'AnzhuangWZ', statusField: 'Zhuangtai', tagFields: ['ShangpinXH'],
    lines: [{ label: '设备编号', field: 'ShangpinBH' }, { label: '人数', field: 'Renshu' }]
  }),
  orderCommissions: native({
    title: '订单分佣', table: 'Diy_DingdanFY', menuAliases: ['订单分佣', '分佣配置', '分佣明细'],
    titleField: 'FenyongR', tagFields: ['FenyongJS'],
    lines: [
      { label: '订单编号', field: 'DingdanBH' },
      { label: '分佣比例', field: 'FenyongBL' },
      { label: '分佣金额', field: 'FenyongJE', format: 'money' },
      { label: '联系电话', field: 'FenyongRDH', format: 'phone' }
    ],
    statisticsField: 'FenyongJE', statisticsLabel: '分佣金额',
    filterFields: [
      { key: 'order', label: '订单编号', field: 'DingdanBH', type: 'text' },
      { key: 'person', label: '分佣人', field: 'FenyongR', type: 'text' },
      { key: 'role', label: '分佣角色', field: 'FenyongJS', type: 'text' },
      { key: 'amount', label: '分佣金额区间', field: 'FenyongJE', type: 'range' }
    ]
  }),
  consumableArchives: native({
    title: '订单耗材', table: 'diy_dingdansphc', menuAliases: ['订单耗材', '设备耗材', '滤芯'],
    titleField: 'LvxinMC', tagFields: ['LvxinXH'],
    lines: [{ label: '级数', field: 'Paixu' }, { label: '更换周期', field: 'GenghuanZQ' }, { label: '单价', field: 'LvxinDJ', format: 'money' }]
  }),
  attendanceRecords: native({
    title: '打卡记录', table: 'Diy_location', menuAliases: ['打卡记录', '拜访打卡', '人员定位'],
    fileMenuAliases: ['人员定位'],
    requireAuthorizedMenu: true,
    titleField: 'BaifangDX', tagFields: ['DakaR'],
    lines: [{ label: '打卡人', field: 'DakaR' }, { label: '打卡时间', field: 'DakaSJ', format: 'datetime' }, { label: '打卡地点', field: 'DakaDD' }],
    summaryField: 'Beizhu', periodField: 'DakaSJ'
  }),
  applicantFamily: native({
    title: '家庭背景', table: 'diy_jiatingbj', menuAliases: ['家庭背景'], titleField: 'Xingming', tagFields: ['Chengwei'],
    lines: [{ label: '称谓', field: 'Chengwei' }, { label: '职业', field: 'Zhiye' }, { label: '工作单位', field: 'GongzuoDW' }]
  }),
  applicantEducation: native({
    title: '教育经历', table: 'diy_xueli', menuAliases: ['教育经历'], titleField: 'XuexiaoMC', tagFields: ['Xuewei'],
    lines: [{ label: '专业', field: 'KexiZY' }, { label: '开始时间', field: 'KaishiSJ', format: 'date' }, { label: '结束时间', field: 'JieshuSJ', format: 'date' }]
  }),
  applicantWork: native({
    title: '工作经历', table: 'diy_gongzuojl', menuAliases: ['工作经历'], titleField: 'GongsiMC', tagFields: ['Zhiwu'],
    lines: [{ label: '任职年期', field: 'RenzhiNQNY' }, { label: '薪资', field: 'Xinzi', format: 'money' }, { label: '离职原因', field: 'LizhiYY' }]
  }),
  applicantCertificates: native({
    title: '专业证书', table: 'diy_zhuanyezs', menuAliases: ['专业证书'], titleField: 'ZhengshuMC', tagFields: ['ZhengshuDJZGDJ'],
    lines: [{ label: '证书等级', field: 'ZhengshuDJZGDJ' }, { label: '发证时间', field: 'FazhengSJ', format: 'date' }]
  }),
  demandResponses: native({
    title: '需求响应', table: 'diy_NeedReleaseRes', menuAliases: ['需求响应', '需求结果'], titleField: 'Shangjia', statusField: 'Zhuangtai',
    lines: [{ label: '商家编号', field: 'ShangjiaID' }, { label: '创建时间', field: 'CreateTime', format: 'datetime' }]
  }),
  performance: { target: 'native-page', title: '业绩统计', path: '/pages/business/stats' },
  cases: native({
    title: '客户案例', table: 'Diy_Anli', menuAliases: ['客户案例', '案例管理'],
    titleField: 'Biaoti', summaryField: 'KehuGK',
    lines: [{ label: '客户', field: 'KehuMC' }, { label: '饮水需求', field: 'YinshuiXQ' }, { label: '创建时间', field: 'CreateTime', format: 'datetime' }]
  }),
  casebooks: native({
    title: '案例册', table: 'diy_anlice', menuAliases: ['案例册'],
    titleField: 'AnliCMC',
    lines: [{ label: '创建人', field: 'UserName' }, { label: '所属商家', field: 'TenantName' }, { label: '修改时间', field: 'UpdateTime', format: 'datetime' }]
  }),
  directory: native({
    title: '通讯录', table: 'Sys_User', menuAliases: ['通讯录', '组织通讯录', '系统用户'],
    titleField: 'Name', statusField: 'State', tagFields: ['RoleName', 'DeptName'], phoneField: 'Phone',
    lines: [{ label: '帐号', field: 'Account' }, { label: '部门', field: 'DeptName' }, { label: '联系电话', field: 'Phone', format: 'phone' }]
  }),
  recruitment: native({
    title: '应聘', table: 'diy_zhaopin', menuAliases: ['应聘', '招聘管理'],
    titleField: 'Xingming', tagFields: ['YixiangGW'], phoneField: 'Dianhua',
    lines: [{ label: '意向岗位', field: 'YixiangGW' }, { label: '联系电话', field: 'Dianhua', format: 'phone' }, { label: '创建时间', field: 'CreateTime', format: 'datetime' }]
  }),
  providers: native({
    title: '我的服务商', table: 'Diy_Tenant', menuAliases: ['我的服务商', '服务商管理', '服务商'],
    titleField: 'TenantName', statusField: 'Zhuangtai', tagFields: ['SuoshuHY'],
    lines: [{ label: '联系人', field: 'LianxiR' }, { label: '联系电话', field: 'LianxiRDH', format: 'phone' }, { label: '所在城市', field: 'Chengshi', format: 'region' }]
  }),
  intentions: native({
    title: '购买意向', table: 'Diy_YixiangDD', menuAliases: ['购买意向', '客户购买意向'],
    titleField: 'ShangpinMC', statusField: 'Zhuangtai',
    lines: [{ label: '姓名', field: 'Xingming' }, { label: '联系电话', field: 'Dianhua', format: 'phone' }, { label: '数量', field: 'Shuliang' }]
  }),
  favorites: native({
    title: '我的收藏', table: 'Diy_ShangpinSC', menuAliases: ['我的收藏', '商品收藏'],
    titleField: 'ShangpinMC', tagFields: ['ShifouSC'],
    lines: [{ label: '收藏用户', field: 'YonghuMC' }, { label: '收藏时间', field: 'CreateTime', format: 'datetime' }]
  }),
  points: native({
    title: '我的积分', table: 'diy_integralRecord', menuAliases: ['我的积分', '积分记录', '积分管理'],
    titleField: 'JifenDesc', statusField: 'Leixing', tagFields: ['Leixing'],
    lines: [{ label: '积分变动', field: 'Jifen' }, { label: '用户', field: 'YonghuMC' }, { label: '时间', field: 'CreateTime', format: 'datetime' }]
  }),
  members: native({
    title: '成员管理', table: 'Sys_User', menuAliases: ['所有成员', '成员管理', '系统用户'],
    titleField: 'Name', statusField: 'State', tagFields: ['RoleName', 'DeptName'], phoneField: 'Phone',
    lines: [{ label: '帐号', field: 'Account' }, { label: '部门', field: 'DeptName' }, { label: '联系电话', field: 'Phone', format: 'phone' }]
  }),
  attendance: { target: 'native-page', title: '拜访打卡', path: '/pages/native/checkin' },
  taskScan: { target: 'native-page', title: '扫码做任务', path: '/pages/task/scan' },
  deviceMap: { target: 'native-page', title: '设备地图', path: '/pages/task/map?mode=device' },
  customerMap: { target: 'native-page', title: '客户地图', path: '/pages/task/map?mode=customer' },
  contactMap: { target: 'native-page', title: '联系人地图', path: '/pages/task/map?mode=contacts' },
  visitMap: { target: 'native-page', title: '跟进地图', path: '/pages/task/map?mode=visit' },
  afterSalesAdd: { target: 'form-add', title: '我要售后', table: 'Diy_ShouhouDD', menuAliases: ['售后订单', '售后任务'] }
}

export const quickActions = ['tasks', 'customers', 'orders', 'devices', 'visits', 'afterSalesAdd', 'attendance', 'directory']

export function getBusinessModule(key) {
  const module = businessModules[key]
  return module ? { key, ...module } : null
}

export function getBusinessEntry(key) {
  for (const group of businessGroups) {
    const item = group.items.find((entry) => entry.key === key)
    if (item) return { ...item, groupKey: group.key, accent: group.accent }
  }
  return null
}

export function getRoleProfile(user = {}) {
  const parseRoles = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'object') return [value]
    if (typeof value !== 'string') return []
    const text = value.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (error) {
      return text.split(/[,，;；]/).map((name) => ({ Name: name.trim() })).filter((role) => role.Name)
    }
  }
  const roleNames = []
  const roleRows = [user.RoleIds, user._Roles, user.Roles, user.RoleName]
    .reduce((rows, value) => rows.concat(parseRoles(value)), [])
  roleRows.forEach((role) => {
    const name = typeof role === 'string'
      ? role
      : role && (role.Name || role.RoleName || role.Label || role.Value)
    if (name && !roleNames.includes(String(name).trim())) roleNames.push(String(name).trim())
  })
  const roleText = roleNames.join('、')
  const isCustomer = /客户（用户）|客户用户|终端客户/.test(roleText)
  const isAdmin = Number(user.Level || 0) >= 998 || roleText.includes('管理员')
  const isSupport = /客服/.test(roleText)
  const isService = /售后|服务|工程|安装/.test(roleText) && !isCustomer
  const isSales = /销售|业务|市场/.test(roleText) && !isCustomer
  const isInternal = !isCustomer && (isAdmin || isService || isSupport || isSales || !!user.TenantId || !!user.DeptId)
  const positionName = user.Zhiwei || user.Position || user.JobName || user.PostName || ''
  const organization = [user.TenantName, positionName || user.DeptName].filter((value, index, values) => value && values.indexOf(value) === index)
  return {
    isAdmin,
    isService,
    isSupport,
    isSales,
    isCustomer,
    isInternal,
    roleNames,
    roleText: roleText || (isInternal ? '内部用户' : '客户用户'),
    primaryRole: roleNames[0] || (isInternal ? '内部用户' : '客户用户'),
    tenantName: user.TenantName || '',
    departmentName: user.DeptName || '',
    positionName,
    organizationText: organization.join(' · '),
    identityText: [...organization, roleText].filter(Boolean).join(' · '),
    allowedGroupKeys: isAdmin
      ? ['customer', 'service', 'oa', 'opportunity']
      : isCustomer
        ? ['service']
        : isSales
          ? ['customer', 'opportunity', 'oa']
          : isSupport
            ? ['customer', 'service', 'oa']
            : isService
              ? ['customer', 'service', 'oa']
              : ['customer', 'service', 'oa', 'opportunity'],
    primaryActions: isAdmin
      ? ['tasks', 'customers', 'orders', 'devices']
      : isCustomer
        ? ['orders', 'devices', 'serviceRecords', 'afterSalesAdd']
        : isSupport
          ? ['tasks', 'customers', 'orders', 'serviceRecords']
          : isService
            ? ['tasks', 'devices', 'attendance', 'serviceRecords']
            : isSales
              ? ['customers', 'visits', 'orders', 'leads']
              : ['orders', 'devices', 'serviceRecords', 'afterSalesAdd']
  }
}

export default { businessGroups, businessModules, quickActions, getBusinessModule, getBusinessEntry, getRoleProfile }
