const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const WebSocketClient = globalThis.WebSocket || require('ws');
const { findWorkspaceRoot } = require('./lib/workspace-paths');

const root = path.resolve(__dirname, '..');
const workspaceRoot = findWorkspaceRoot(root);
const h5Root = path.join(root, 'dist', 'build', 'h5');
const outputRoot = path.join(workspaceRoot, '.tmp', 'xjy-uniapp-visual');

const customers = [
  { Id: 'customer-001', KehuMC: '滨江区实验学校', Zhuangtai: '合作中', KehuLX: '学校', KehuGJZT: '持续服务', FuzeR: '王经理', Chengshi: '["浙江省","杭州市","滨江区"]', XiaciGJRQ: '2026-07-18 09:30:00', YuqiJYJE: 168000, CreateTime: '2026-07-16 08:20:00' },
  { Id: 'customer-002', KehuMC: '钱塘科创中心', Zhuangtai: '合作中', KehuLX: '园区', KehuGJZT: '方案确认', FuzeR: '陈顾问', Chengshi: '["浙江省","杭州市","钱塘区"]', XiaciGJRQ: '2026-07-19 14:00:00', YuqiJYJE: 92000, CreateTime: '2026-07-15 10:10:00' },
  { Id: 'customer-003', KehuMC: '星澜健康产业园', Zhuangtai: '跟进中', KehuLX: '企业', KehuGJZT: '商务洽谈', FuzeR: '林经理', Chengshi: '["浙江省","杭州市","余杭区"]', XiaciGJRQ: '2026-07-21 10:00:00', YuqiJYJE: 235000, CreateTime: '2026-07-14 16:40:00' },
  { Id: 'customer-004', KehuMC: '湖畔人才公寓', Zhuangtai: '待签约', KehuLX: '公寓', KehuGJZT: '合同拟定', FuzeR: '周顾问', Chengshi: '["浙江省","杭州市","西湖区"]', XiaciGJRQ: '2026-07-22 15:30:00', YuqiJYJE: 76000, CreateTime: '2026-07-13 11:25:00' }
];

for (let index = 5; index <= 45; index += 1) {
  customers.push({
    Id: `customer-${String(index).padStart(3, '0')}`,
    KehuMC: `集福鲤客户 ${String(index).padStart(2, '0')}`,
    Zhuangtai: index % 3 === 0 ? '跟进中' : '合作中',
    KehuLX: index % 2 === 0 ? '企业' : '学校',
    KehuGJZT: index % 3 === 0 ? '商务洽谈' : '持续服务',
    FuzeR: index % 2 === 0 ? '陈顾问' : '王经理',
    Chengshi: '["浙江省","杭州市","滨江区"]',
    XiaciGJRQ: '2026-07-25 09:30:00',
    YuqiJYJE: 50000 + index * 1000,
    CreateTime: `2026-07-${String(20 - (index % 10)).padStart(2, '0')} 09:20:00`
  });
}

const sysUserTable = {
  Id: 'table-sys-user', Name: 'Sys_User', Description: '员工信息',
  Tabs: JSON.stringify([
    { Id: '01TABACCOUNT', Name: '账号信息' },
    { Id: '01TABPROFILE', Name: '个人设置' }
  ])
};

const sysUserFields = [
  { Id: 'field-avatar', TableName: 'Sys_User', Name: 'Avatar', Label: '头像', Component: 'Text', Visible: 1, AppVisible: 1, Sort: 10, Tab: '01TABACCOUNT', Config: '{}' },
  { Id: 'field-no', TableName: 'Sys_User', Name: 'No', Label: '编号', Component: 'Text', Visible: 1, AppVisible: 1, Readonly: 1, Sort: 20, Tab: '01TABACCOUNT', Config: '{}' },
  { Id: 'field-account', TableName: 'Sys_User', Name: 'Account', Label: '登录账号', Component: 'Text', Visible: 1, AppVisible: 1, Readonly: 1, NotEmpty: 1, Sort: 30, Tab: '01TABACCOUNT', Config: '{}' },
  { Id: 'field-name', TableName: 'Sys_User', Name: 'Name', Label: '姓名', Component: 'Text', Visible: 1, AppVisible: 1, Sort: 40, Tab: '01TABACCOUNT', Config: '{}' },
  { Id: 'field-phone', TableName: 'Sys_User', Name: 'Phone', Label: '手机号', Component: 'Text', Visible: 1, AppVisible: 1, Sort: 50, Tab: '01TABACCOUNT', Config: '{}' },
  { Id: 'field-user-type', TableName: 'Sys_User', Name: 'UserType', Label: '账号类型', Component: 'Radio', Visible: 1, AppVisible: 1, Sort: 60, Tab: '01TABPROFILE', Data: 'Tenant|租户账号,Employee|员工账号', Config: '{"SelectSaveFormat":"Text"}' },
  { Id: 'field-sex', TableName: 'Sys_User', Name: 'Sex', Label: '性别', Component: 'Radio', Visible: 1, AppVisible: 1, Sort: 70, Tab: '01TABPROFILE', Data: '男|男,女|女', Config: '{"SelectSaveFormat":"Text"}' },
  { Id: 'field-area', TableName: 'Sys_User', Name: 'ServiceArea', Label: '服务区域', Component: 'Address', Visible: 1, AppVisible: 1, Sort: 80, Tab: '01TABPROFILE', Config: '{}' },
  { Id: 'field-contacts', TableName: 'Sys_User', Name: 'ServiceContacts', Label: '服务联系人', Component: 'MultipleSelect', Visible: 1, AppVisible: 1, Sort: 90, Tab: '01TABPROFILE', Data: '[]', Config: '{"SelectLabel":"Xingming","SelectSaveField":"Id"}' },
  { Id: 'field-intro', TableName: 'Sys_User', Name: 'Biography', Label: '个人简介', Component: 'RichText', Visible: 1, AppVisible: 1, Sort: 100, Tab: '01TABPROFILE', Config: '{}' }
];

const sysUserRow = {
  Id: 'user-001', Avatar: '{"Id":"legacy_1776731501940","Name":"tmp_0336ec46d0fdfc7297bd2adebad14acaaf08ae96bfb54047.jpg","Size":"","CreateTime":"","Path":"/xjy/img/20240820/tmp_0336ec46d0fdfc7297bd2adebad14acaaf08ae96bfb54047.jpg","State":1}',
  No: 'JFL-001', Account: 'admin', Name: '张服务', Phone: '13900001234', UserType: 'Tenant', Sex: '男',
  ServiceArea: '["浙江省","宁波市","鄞州区"]',
  ServiceContacts: '[{"Id":"contact-001","CreateTime":"2026-07-20 11:02:12","UserName":"管理员","Xingming":"赵经理","ShoujiH":"13800000001"}]',
  Biography: '<p><strong>负责宁波片区售后服务</strong></p>'
};

const merchantDetail = {
  Id: 'merchant-001', TenantName: '新纪源测试商家', Zhuangtai: '通过', LianxiR: '12345', LianxiRDH: '12345',
  Chengshi: '["浙江省","宁波市","鄞州区"]', Dizhi: '111', ZhuyingCP: '净水设备与维保服务',
  SuoshuHY: '[{"Id":"industry-001","CreateTime":"2024-05-11 12:00:00","UserName":"管理员","HangyeMC":"水处理设备"}]',
  ShangjiaJS: '<p><strong>专业提供直饮水设备与售后服务。</strong></p>', Beizhu: '', CreateTime: '2024-05-21 11:41:00'
};

const customerDetail = {
  ...customers[0],
  LianxiR: '李老师',
  LianxiDH: '13800001234',
  FuzeRID: '',
  KehuGJZT: '公海',
  XiangxiDZ: '江南大道 88 号',
  SuoshuPQ: '滨江服务片区',
  BaoyangZQ: 3,
  ShuizhiJCZQ: 6,
  FuwuKSSJ: '2026-08-01',
  FuwuJSSJ: '2029-07-31',
  KehuGK: '校园饮水服务客户，覆盖教学楼与行政楼。',
  Beizhu: '暑期完成设备巡检后进入新学期保障。'
};

const privateCustomerDetail = {
  ...customerDetail,
  Id: 'customer-private-001',
  KehuMC: '私有客户按钮验证',
  KehuGJZT: null,
  KehuGJZTZ: null,
  FuzeR: '张服务',
  FuzeRID: 'user-001'
};

const otherOwnerPrivateCustomerDetail = {
  ...privateCustomerDetail,
  Id: 'customer-private-other-001',
  KehuMC: '其他负责人私有客户',
  FuzeR: '其他测试负责人',
  FuzeRID: 'user-other'
};

const leadDetail = {
  Id: 'lead-001',
  XiansuoMC: '未来科技园直饮水项目',
  KehuMC: '未来科技园',
  LianxiR: '赵主任',
  ShoujiH: '13600001234',
  Bumen: '行政部',
  TenantName: '集福鲤杭州运营中心',
  FuzeR: '',
  FuzeRID: '',
  Zhuangtai: '待领取',
  ZhuangtaiZ: 1,
  XiansuoXQ: '园区三栋办公楼计划建设公共直饮水点位，需完成现场勘察和初步方案。',
  CreateTime: '2026-07-16 10:30:00'
};

const taskDetail = {
  Id: 'task-001', ShouhouFWBH: 'SH202607160018', Zhuangtai: '待服务', Leixing: '保养',
  KehuID: 'customer-001', KehuMC: '滨江区实验学校', KehuLXRR: '李老师', KehuDH: '13800001234',
  Chengshi: '["浙江省","杭州市","滨江区"]', Dizhi: '江南大道 88 号', AnzhuangWZ: '教学楼一层饮水间',
  DingdanID: 'order-001', DingdanBH: 'DD202512080032', YujiSHSJ: '2026-07-16 14:00:00', YuyueSJ: '2026-07-16 13:30:00',
  JiedanSJ: '2026-07-16 08:45:00', ShouhouRYID: 'user-001', ShouhouRY: '张服务', ShouhouRYDH: '13900001234',
  SuoshuPQ: '滨江服务片区', ZhipaiR: '客服中心', ZhipaiSJ: '2026-07-15 17:20:00',
  Neirong: '例行检查净水主机运行状态，更换前置滤芯并完成出水水质检测。',
  ShouhouFY: 0, TenantName: '集福鲤杭州运营中心', CreateTime: '2026-07-15 17:18:00'
};

const orderDetail = {
  Id: 'order-001', DingdanBH: 'DD202512080032', HetongBH: 'HT202512080018', DingdanZT: '待审批', DingdanZTZ: 1,
  XinLDD: '新签订单', DingdanHZFS: '租赁服务', DingdanJE: 268000, XiadanRQ: '2026-07-15', YujiSKSJ: '2026-07-25',
  KehuID: 'customer-001', KehuMC: '滨江区实验学校', LianxiR: '李老师', LianxiDH: '13800001234',
  YewuY: '王经理', YewuYDH: '13700001234', TenantName: '集福鲤杭州运营中心',
  HetongKSSJ: '2026-08-01', HetongJSSJ: '2029-07-31', FuwuKSSJ: '2026-08-01', FuwuJSSJ: '2029-07-31',
  BaoyangZQ: 3, ShuizhiJCZQ: 6, ShouhouRY: '张服务', ShouhouRYDH: '13900001234', CreateTime: '2026-07-15 09:20:00'
};

const deviceDetail = {
  Id: 'device-001', ShebeiBH: 'SB-HZ-2026-0068', ShangpinMC: '集福鲤校园直饮机', ShebeiXH: 'JFL-S600',
  ShebeiZT: '正常使用', ShebeiGZZT: '在线', HezuoFS: '租赁', KehuID: 'customer-001', KehuMC: '滨江区实验学校',
  DingdanID: 'order-001', DingdanBH: 'DD202512080032', AnzhuangWZ: '教学楼一层饮水间', TenantName: '集福鲤杭州运营中心',
  FuwuKSSJ: '2026-08-01', FuwuJSSJ: '2029-07-31', ZuijinFWSJ: '2026-06-18', ZhibaoSJ: '2028-07-31',
  Beizhu: '设备运行正常，下次保养前检查滤芯余量。', CreateTime: '2026-01-08 11:30:00'
};

const recruitmentDetail = {
  Id: 'recruit-001', Xingming: '周明', ShoujiH: '13500001234', Xingbie: '男', Nianling: 29,
  YingpinGW: '售后服务工程师', Xueli: '本科', KexiZY: '环境工程', GongzuoNX: 6,
  Zhuangtai: '面试中', QiwangXZ: 9500, SuoshuPQ: '滨江服务片区', CreateTime: '2026-07-12 09:30:00'
};

const demandDetail = {
  Id: 'demand-001', Xuqiu: '园区饮水设备年度维保', XuqiuNR: '需要完成 18 台设备巡检、滤芯更换与水质检测。',
  FabuR: '赵主任', FabuRID: 'user-demand-001', Diqu: '杭州市滨江区', ZhidingHY: '企业园区',
  SuoshuPQ: '滨江服务片区', Zhuangtai: '响应中', CreateTime: '2026-07-13 14:20:00'
};

const casebookDetail = {
  Id: 'book-001', AnliCMC: '校园饮水标杆案例', UserName: '王经理', TenantName: '集福鲤杭州运营中心',
  CreateTime: '2026-07-08 10:00:00', UpdateTime: '2026-07-16 17:30:00'
};

const casebookChildren = [
  {
    Id: 'book-child-001', GuanlianID: 'book-001', AnliID: 'case-001', Biaoti: '滨江区实验学校直饮水升级',
    KehuMC: '滨江区实验学校', XiangmuGM: '覆盖 6 栋教学楼、32 个饮水点位',
    TuijianPY: '暑期集中改造，开学前完成验收', AnliTP: ''
  },
  {
    Id: 'book-child-002', GuanlianID: 'book-001', AnliID: 'case-002', Biaoti: '钱塘科创中心智慧饮水项目',
    KehuMC: '钱塘科创中心', XiangmuGM: '18 台联网设备统一运维',
    TuijianPY: '在线监测与周期维保协同落地', AnliTP: ''
  }
];

const sourceCases = [
  { Id: 'case-001', Biaoti: '滨江区实验学校直饮水升级', KehuMC: '滨江区实验学校' },
  { Id: 'case-002', Biaoti: '钱塘科创中心智慧饮水项目', KehuMC: '钱塘科创中心' },
  { Id: 'case-003', Biaoti: '湖畔人才公寓饮水保障', KehuMC: '湖畔人才公寓' }
];

const taskDevices = [
  { Id: 'task-device-001', ShouhouDDID: 'task-001', ShebeiMC: '校园直饮机 A', ShebeiXH: 'JFL-S600', ShebeiBH: 'SB-HZ-2026-0068', AnzhuangWZ: '教学楼一层', FuwuZT: '已完成', ShebeiPX: 1 },
  { Id: 'task-device-002', ShouhouDDID: 'task-001', ShebeiMC: '校园直饮机 B', ShebeiXH: 'JFL-S600', ShebeiBH: 'SB-HZ-2026-0069', AnzhuangWZ: '教学楼三层', FuwuZT: '已完成', ShebeiPX: 2 }
];

const products = [
  { Id: 'product-001', ShangpinMC: '校园直饮水一体机', ShangpinBH: 'JFL-S600', ShangpinLX: '设备', Xianjia: 12800, ZulinXJ: 3980, TenantName: '集福鲤杭州运营中心', ShangpinZTZ: 1 },
  { Id: 'product-002', ShangpinMC: '商务净饮水机', ShangpinBH: 'JFL-B320', ShangpinLX: '设备', Xianjia: 8600, ZulinXJ: 2680, TenantName: '集福鲤企业服务中心', ShangpinZTZ: 1 },
  { Id: 'product-003', ShangpinMC: '复合净化滤芯套装', ShangpinBH: 'LX-4PRO', ShangpinLX: '耗材', Xianjia: 680, TenantName: '集福鲤供应链', ShangpinZTZ: 1 }
];

const productCategories = [
  { Id: 'category-001', Mingcheng: '直饮设备', _Child: [{ Id: 'category-001-1', Mingcheng: '校园场景' }] },
  { Id: 'category-002', Mingcheng: '滤芯耗材', _Child: [] }
];

const news = [
  { Id: 'news-001', Biaoti: '集福鲤校园饮水服务完成暑期巡检升级', UpdateTime: '2026-07-16 09:20:00', BrowseNum: 326, Zhuangtai: '已发布' },
  { Id: 'news-002', Biaoti: '从设备在线率看夏季饮水保障重点', UpdateTime: '2026-07-15 15:40:00', BrowseNum: 218, Zhuangtai: '已发布' },
  { Id: 'news-003', Biaoti: '服务团队完成滨江片区水质抽检', UpdateTime: '2026-07-14 11:05:00', BrowseNum: 185, Zhuangtai: '已发布' }
];

const moduleRows = {
  Diy_Kehu: { rows: customers, count: customers.length, statistics: { YuqiJYJE: 571000 } },
  Diy_ShouhouDD: { rows: [taskDetail], count: 7, statistics: {} },
  Diy_Dingdan: { rows: [], count: 28, statistics: { DingdanJE: 1268000 } },
  Diy_KehuSB: { rows: [], count: 143, statistics: {} },
  Diy_Tenant: { rows: [merchantDetail], count: 1, statistics: {} }
};

const mockRequestLog = [];

function requestDateRange(body = {}) {
  const searchRange = body._SearchDateTime && Object.values(body._SearchDateTime)[0];
  if (Array.isArray(searchRange) && searchRange.length === 2) return searchRange;
  const where = Array.isArray(body._Where) ? body._Where : [];
  const start = where.find((item) => item && item.Type === '>=' && /^\d{4}-\d{2}-\d{2}/.test(String(item.Value || '')));
  const end = where.find((item) => item && item.Type === '<=' && /^\d{4}-\d{2}-\d{2}/.test(String(item.Value || '')));
  return start && end ? [start.Value, end.Value] : null;
}

function periodCount(body, fallback) {
  const range = requestDateRange(body);
  if (!range) return fallback;
  const start = new Date(String(range[0]).replace(' ', 'T'));
  const end = new Date(String(range[1]).replace(' ', 'T'));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return fallback;
  if (start.getFullYear() < new Date().getFullYear()) return Math.min(fallback, 3);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days <= 2) return Math.min(fallback, 2);
  if (days <= 8) return Math.min(fallback, 5);
  if (days <= 32) return Math.min(fallback, 9);
  if (days <= 100) return Math.min(fallback, 14);
  return Math.min(fallback, 24);
}

const targets = [
  {
    name: 'home', route: '/#/pages/workspace/index', selector: '.home-page',
    required: ['.home-header', '.mci-water-motion__video', '.quick-grid', '.business-section'],
    requireHeroVideo: true
  },
  {
    name: 'home-ai', route: '/#/pages/workspace/index', selector: '.home-page',
    clickSelector: '.mci-ai-launcher', afterSelector: '.assistant-route-page .ai-assistant__panel',
    touchTap: true,
    selectorAfterClick: '.assistant-route-page',
    required: ['.ai-assistant__panel', '.ai-assistant__model', '.ai-assistant__prompts', '.ai-assistant__composer'],
    expectedText: ['集福鲤 · AI助手', '内容由人工智能生成，请注意甄别', '数据权限已校验', 'Microi.AI中转站', 'MiniMax-M3'],
    requireHiddenTabBar: true,
    requireVisibleComposer: true,
    requireFullscreenPanel: true,
    requireCapsuleAvoidance: true
  },
  {
    name: 'home-ai-history', route: '/#/pages/workspace/index', selector: '.home-page',
    clickSelector: '.mci-ai-launcher', afterSelector: '.assistant-route-page .ai-assistant__panel',
    touchTap: true,
    selectorAfterClick: '.assistant-route-page',
    secondClickSelector: '.ai-assistant__header-actions .ai-assistant__icon-button',
    afterSecondSelector: '.ai-assistant__drawer',
    required: ['.ai-assistant__drawer', '.ai-assistant__history-tabs', '.ai-assistant__history-item'],
    expectedText: ['对话记录', 'AI对话', '已归档', '本月服务质量概览'],
    requireHiddenTabBar: true,
    requireFullscreenPanel: true,
    requireCapsuleAvoidance: true
  },
  {
    name: 'ai-guest', route: '/#/pages/ai/index', selector: '.assistant-route-page',
    anonymous: true,
    required: ['.ai-assistant__panel', '.ai-assistant__auth-state'],
    expectedText: ['集福鲤 · AI助手', '登录后使用AI数据分析', '登录前不会读取、分析或展示任何业务数据'],
    requireHiddenTabBar: true,
    requireFullscreenPanel: true,
    requireCapsuleAvoidance: true
  },
  {
    name: 'catalog', route: '/#/pages/business/catalog', selector: '.catalog-page',
    required: ['.catalog-header', '.catalog-group', '.entry-row']
  },
  {
    name: 'customers', route: '/#/pages/business/list?key=customers', selector: '.list-page',
    required: ['.summary-strip', '.data-card', '.period-tabs']
  },
  {
    name: 'customer-detail', route: '/#/pages/business/detail?key=customers&id=customer-001', selector: '.detail-page',
    required: ['.hero-band', '.quick-band', '.bottom-actions'],
    expectedText: ['领取客户'],
    forbiddenText: ['移入公海']
  },
  {
    name: 'customer-private-detail', route: '/#/pages/business/detail?key=customers&id=customer-private-001', selector: '.detail-page',
    required: ['.hero-band', '.quick-band', '.bottom-actions'],
    expectedText: ['移入公海'],
    forbiddenText: ['领取客户']
  },
  {
    name: 'customer-private-other-owner', route: '/#/pages/business/detail?key=customers&id=customer-private-other-001', selector: '.detail-page',
    required: ['.hero-band', '.quick-band', '.bottom-actions'],
    expectedText: ['生成任务'],
    forbiddenText: ['领取客户', '移入公海']
  },
  {
    name: 'merchant-list', route: '/#/pages/business/list?key=stores', selector: '.list-page',
    required: ['.summary-strip', '.data-card', '.period-tabs'],
    forbiddenText: ['["浙江省"', '"HangyeMC"', '<p>']
  },
  {
    name: 'merchant-detail', route: '/#/pages/business/detail?key=stores&id=merchant-001', selector: '.detail-page',
    required: ['.hero-band', '.info-band'],
    forbiddenText: ['补充说明', '["浙江省"', '"HangyeMC"', '<p>']
  },
  {
    name: 'lead-detail', route: '/#/pages/business/detail?key=leads&id=lead-001', selector: '.detail-page',
    required: ['.hero-band', '.relation-panel', '.bottom-actions']
  },
  {
    name: 'task-detail', route: '/#/pages/business/detail?key=tasks&id=task-001', selector: '.detail-page',
    required: ['.hero-band', '.info-band', '.bottom-actions']
  },
  {
    name: 'task-list', route: '/#/pages/task/list', selector: '.task-page',
    required: ['.mci-page-shell__title', '.state-card', '.period-chip', '.task-card'],
    expectedText: ['售后任务', '去年']
  },
  {
    name: 'order-approval', route: '/#/pages/business/detail?key=orders&id=order-001', selector: '.detail-page',
    clickSelector: '.bottom-actions .action-button--primary', afterSelector: '.approval-opinion',
    required: ['.hero-band', '.dialog-panel', '.approval-opinion'], expectedText: ['审批通过', '资料完整']
  },
  {
    name: 'device-detail', route: '/#/pages/business/detail?key=devices&id=device-001', selector: '.detail-page',
    required: ['.hero-band', '.info-band', '.bottom-actions']
  },
  {
    name: 'recruitment-detail', route: '/#/pages/business/detail?key=recruitment&id=recruit-001', selector: '.detail-page',
    required: ['.hero-band', '.relation-panel', '.info-band']
  },
  {
    name: 'demand-detail', route: '/#/pages/business/detail?key=demands&id=demand-001', selector: '.detail-page',
    required: ['.hero-band', '.relation-panel', '.info-band']
  },
  {
    name: 'service-record', route: '/#/pages/native/service-record?customerId=customer-001', selector: '.service-record-page',
    required: ['.form-panel', '.service-panel', '.bottom-bar']
  },
  {
    name: 'service-record-picker', route: '/#/pages/native/service-record?customerId=customer-001', selector: '.service-record-page',
    clickSelector: '.field-row--tap', afterSelector: '.picker-sheet',
    required: ['.form-panel', '.picker-sheet', '.customer-list']
  },
  {
    name: 'casebook', route: '/#/pages/native/casebook?id=book-001', selector: '.casebook-page',
    required: ['.book-panel', '.case-list', '.add-case-button']
  },
  {
    name: 'casebook-picker', route: '/#/pages/native/casebook?id=book-001', selector: '.casebook-page',
    clickSelector: '.add-case-button', afterSelector: '.picker-sheet',
    required: ['.book-panel', '.picker-sheet', '.source-list']
  },
  {
    name: 'task-follow-up', route: '/#/pages/native/task-follow-up?id=task-001', selector: '.follow-up-page',
    required: ['.task-band', '.upload-panel', '.bottom-bar']
  },
  {
    name: 'watermark-camera', route: '/#/pages/native/watermark-camera?customer=滨江区实验学校&address=江南大道88号', selector: '.camera-page',
    required: ['.camera-fallback', '.watermark-preview', '.camera-controls']
  },
  {
    name: 'task-feedback', route: '/#/pages/native/task-feedback?taskId=task-001&taskNo=SH202607160018&customer=滨江区实验学校&taskType=保养', selector: '.feedback-page',
    required: ['.summary-band', '.device-row', '.bottom-bar']
  },
  {
    name: 'mall', route: '/#/pages/mall/index', selector: '.mall-container',
    required: ['.search-header', '.category-sidebar', '.product-card']
  },
  {
    name: 'news', route: '/#/pages/news/index', selector: '.news-container',
    required: ['.news-header', '.news-item-featured', '.news-item']
  },
  {
    name: 'message', route: '/#/pages/message/index', selector: '.message-container',
    required: ['.msg-header', '.msg-tabs', '.search-section'],
    allowedErrorPatterns: ['[SignalR] connect error: Error: No connectionToken from negotiate']
  },
  {
    name: 'profile', route: '/#/pages/profile/index', selector: '.profile-page',
    required: ['.profile-hero', '.mci-water-motion__video', '.summary-panel', '.menu-group'],
    requireHeroVideo: true
  },
  {
    name: 'login', route: '/#/pages/login/index', selector: '.login-container',
    required: ['.login-nav', '.login-water', '.logo-section', '.form-section', '.account-login-btn'],
    forbiddenSelectors: ['.mci-water-motion__video', 'video']
  },
  {
    name: 'native-user-form', route: '/#/pages/native-form/index?table=Sys_User&id=user-001&mode=Edit&title=个人资料', selector: '.native-form-page',
    required: ['.mci-media-uploader__item--circle', '.native-control__options', '.form-section__header'],
    forbiddenText: ['{"Id"', '01TABACCOUNT', '01TABPROFILE']
  },
  {
    name: 'native-user-view', route: '/#/pages/native-form/index?table=Sys_User&id=user-001&mode=View&title=个人资料', selector: '.native-form-page',
    required: ['.mci-media-uploader__item--circle', '.native-control__richtext', '.form-section__header'],
    forbiddenText: ['{"Id"', '"CreateTime"', '["浙江省"', '<p>', '01TABACCOUNT', '01TABPROFILE'],
    requireLoadedImages: true
  }
];

const viewports = [
  {
    name: 'iphone-390x844',
    width: 390,
    height: 844,
    scale: 2,
    safe: { top: 47, bottom: 34, left: 0, right: 0, capsuleRight: 96, capsuleTop: 51, capsuleHeight: 32 }
  },
  {
    name: 'android-412x915',
    width: 412,
    height: 915,
    scale: 2,
    safe: { top: 32, bottom: 24, left: 0, right: 0, capsuleRight: 96, capsuleTop: 36, capsuleHeight: 32 }
  },
  {
    name: 'large-430x932',
    width: 430,
    height: 932,
    scale: 2,
    safe: { top: 0, bottom: 0, left: 0, right: 0, capsuleRight: 0 }
  }
];

const activeViewports = process.env.XJY_VISUAL_VIEWPORT
  ? viewports.filter((item) => item.name === process.env.XJY_VISUAL_VIEWPORT)
  : viewports;
const requestedTargets = String(process.env.XJY_VISUAL_TARGET || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const activeTargets = process.env.XJY_VISUAL_TARGET
  ? targets.filter((item) => requestedTargets.includes(item.name))
  : targets;

if (!activeViewports.length) throw new Error(`Unknown XJY_VISUAL_VIEWPORT: ${process.env.XJY_VISUAL_VIEWPORT}`);
if (!activeTargets.length) throw new Error(`Unknown XJY_VISUAL_TARGET: ${process.env.XJY_VISUAL_TARGET}`);

function fail(message) {
  throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2'
  }[extension] || 'application/octet-stream';
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';
    let filePath = path.normalize(path.join(h5Root, pathname));
    if (!filePath.startsWith(h5Root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(h5Root, 'index.html');
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
      response.end(data);
    });
  });
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.once('error', reject);
  });
}

async function waitForDebugger(port, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (error) {}
    await delay(250);
  }
  fail('Browser debugger did not start.');
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH, process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const command of ['chrome', 'msedge', 'chromium']) {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8' });
    if (result.status === 0) {
      const candidate = result.stdout.split(/\r?\n/).find(Boolean);
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocketClient(wsUrl);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const messageId = ++id;
        socket.send(JSON.stringify({ id: messageId, method, params }));
        return new Promise((sendResolve, sendReject) => pending.set(messageId, { resolve: sendResolve, reject: sendReject }));
      },
      on(method, listener) {
        const items = listeners.get(method) || [];
        items.push(listener);
        listeners.set(method, items);
      },
      close() { socket.close(); }
    }));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result || {});
        return;
      }
      if (message.method && listeners.has(message.method)) {
        listeners.get(message.method).forEach((listener) => Promise.resolve(listener(message.params || {})).catch(() => {}));
      }
    });
    socket.addEventListener('error', reject);
  });
}

function parsePostData(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch (error) {}
  try { return Object.fromEntries(new URLSearchParams(value)); } catch (error) { return {}; }
}

function buildMockResponse(request) {
  const url = String(request.url || '');
  const lowerUrl = url.toLowerCase();
  const body = parsePostData(request.postData);
  const table = body.ModuleEngineKey || body.FormEngineKey || '';
  const apiEngineMatch = lowerUrl.match(/\/apiengine\/([^?/#]+)/);
  const apiEngineKey = String(body.ApiEngineKey || (apiEngineMatch && apiEngineMatch[1]) || '').toLowerCase();
  mockRequestLog.push({ url, body, table, time: Date.now() });

  if (request.method === 'OPTIONS') return { status: 204, body: '' };
  if (lowerUrl.includes('getsysconfig') || lowerUrl.includes('microi-init')) {
    return { Code: 1, Data: { SysTitle: '集福鲤', SysShortTitle: '集福鲤', CompanyName: '新纪源水科技', IsShowAiAssistant: 1 } };
  }
  if (lowerUrl.includes('formengine/getdiytablemodel')) {
    return { Code: 1, Data: sysUserTable };
  }
  if (lowerUrl.includes('formengine/getdiyfieldlist')) {
    return { Code: 1, Data: sysUserFields, DataCount: sysUserFields.length };
  }
  if (lowerUrl.includes('moduleengine/gettabledata')) {
    const result = moduleRows[table] || { rows: [], count: 0, statistics: {} };
    const effectiveCount = periodCount(body, result.count);
    const pageIndex = Math.max(1, Number(body._PageIndex || 1));
    const pageSize = Math.max(1, Number(body._PageSize || 20));
    const pageRows = result.rows.slice((pageIndex - 1) * pageSize, Math.min(pageIndex * pageSize, effectiveCount));
    return { Code: 1, Data: pageRows, DataCount: effectiveCount, DataAppend: { StatisticsFields: result.statistics } };
  }
  if (lowerUrl.includes('gettabledatatreeanonymous') && table === 'Diy_Fenlei') {
    return { Code: 1, Data: productCategories, DataCount: productCategories.length };
  }
  if (lowerUrl.includes('gettabledataanonymous') && table === 'Diy_Shangpin') {
    return { Code: 1, Data: products, DataCount: products.length };
  }
  if (lowerUrl.includes('gettabledataanonymous') && table === 'Diy_Zixun') {
    return { Code: 1, Data: news, DataCount: news.length };
  }
  if (lowerUrl.includes('gettabledataanonymous') && table === 'Diy_Lunbotu') {
    return { Code: 1, Data: [], DataCount: 0 };
  }
  if (lowerUrl.includes('getgoodstype')) {
    return { Code: 1, Data: [{ Key: 'device', Value: '设备' }, { Key: 'filter', Value: '耗材' }] };
  }
  if (lowerUrl.includes('getsysbasedata')) {
    return {
      Code: 1,
      Data: [
        { Id: 'service-type-001', Key: '保养', Value: '设备保养', Name: '设备保养' },
        { Id: 'service-type-002', Key: '滤芯', Value: '滤芯更换', Name: '滤芯更换' },
        { Id: 'service-type-003', Key: '水质', Value: '水质检测', Name: '水质检测' },
        { Id: 'service-type-004', Key: '巡检', Value: '设备巡检', Name: '设备巡检' }
      ]
    };
  }
  if (lowerUrl.includes('gettabledata') && (table === 'diy_shouhousp' || lowerUrl.includes('diy_shouhousp'))) {
    return { Code: 1, Data: taskDevices, DataCount: taskDevices.length };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_anlice_child') {
    return { Code: 1, Data: casebookChildren, DataCount: casebookChildren.length };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_anli') {
    return { Code: 1, Data: sourceCases, DataCount: sourceCases.length };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_kehu') {
    const pageIndex = Math.max(1, Number(body._PageIndex || 1));
    const pageSize = Math.max(1, Number(body._PageSize || 20));
    return { Code: 1, Data: customers.slice((pageIndex - 1) * pageSize, pageIndex * pageSize), DataCount: customers.length };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_field') {
    return { Code: 1, Data: sysUserFields, DataCount: sysUserFields.length };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_sjyijian') {
    return { Code: 1, Data: [{ Id: 'opinion-1', YijianNR: '审批通过' }, { Id: 'opinion-2', YijianNR: '资料完整' }], DataCount: 2 };
  }
  if (lowerUrl.includes('gettabledata') && String(table).toLowerCase() === 'diy_dingdan') {
    return { Code: 1, Data: [orderDetail], DataCount: 1 };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_ShouhouDD' || lowerUrl.includes('diy_shouhoudd'))) {
    return { Code: 1, Data: taskDetail };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_Dingdan' || lowerUrl.includes('diy_dingdan'))) {
    return { Code: 1, Data: orderDetail };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_KehuSB' || lowerUrl.includes('diy_kehusb'))) {
    return { Code: 1, Data: deviceDetail };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_Kehu' || lowerUrl.includes('diy_kehu'))) {
    if (body.Id === privateCustomerDetail.Id) return { Code: 1, Data: privateCustomerDetail };
    if (body.Id === otherOwnerPrivateCustomerDetail.Id) return { Code: 1, Data: otherOwnerPrivateCustomerDetail };
    return { Code: 1, Data: customerDetail };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_Tenant' || lowerUrl.includes('diy_tenant'))) {
    return { Code: 1, Data: merchantDetail };
  }
  if (lowerUrl.includes('getformdata') && (table === 'Diy_Xiansuo' || lowerUrl.includes('diy_xiansuo'))) {
    return { Code: 1, Data: leadDetail };
  }
  if (lowerUrl.includes('getformdata') && String(table).toLowerCase() === 'diy_zhaopin') {
    return { Code: 1, Data: recruitmentDetail };
  }
  if (lowerUrl.includes('getformdata') && String(table).toLowerCase() === 'diy_needrelease') {
    return { Code: 1, Data: demandDetail };
  }
  if (lowerUrl.includes('getformdata') && String(table).toLowerCase() === 'diy_anlice') {
    return { Code: 1, Data: casebookDetail };
  }
  if (lowerUrl.includes('getformdata') && table === 'diy_table') {
    return { Code: 1, Data: sysUserTable };
  }
  if (lowerUrl.includes('getformdata') && String(table).toLowerCase() === 'sys_user') {
    return { Code: 1, Data: sysUserRow };
  }
  if (lowerUrl.includes('getsysmenustep')) return { Code: 1, Data: [] };
  if (apiEngineKey === 'type-tongji') {
    return {
      Code: 1,
      Data: [{ Value: '安装', count: 1 }, { Value: '维修', count: 2 }, { Value: '保养', count: 3 }, { Value: '换芯+保养', count: 1 }, { Value: '投诉', count: 0 }],
      DataAppend: { PeriodCounts: { all: 7, today: 1, week: 3, month: 7, quarter: 7, year: 7, lastYear: 4 } }
    };
  }
  if (apiEngineKey === 'service_statusstatistics') {
    return { Code: 1, Data: { pending: 1, TodoCount: 2, acceptance: 1, cacceptance: 1, evaluated: 1, FinishCount: 1, cancel: 0, suspend: 0 } };
  }
  if (apiEngineKey === 'mci_ai_data_assistant') {
    const action = String(body.Action || '').toLowerCase();
    if (action === 'bootstrap') {
      return {
        Code: 1,
        Data: {
          Enabled: true,
          ScopeLabel: '本人负责数据',
          RoleText: '售后服务工程师',
          AllowedDomains: ['customers', 'tasks', 'devices'],
          Models: [{
            Id: 'model-001',
            Name: 'Microi.AI中转站',
            AiModel: 'Microi.AI中转站',
            IsRelayStation: true
          }],
          RelayModels: [{ Id: 'MiniMax-M3', Name: 'MiniMax', DisplayName: 'MiniMax' }],
          Prompts: ['我的待办服务分析', '本月服务质量概览', '客户设备异常情况']
        }
      };
    }
    if (action === 'history') {
      return {
        Code: 1,
        Data: {
          Conversations: [
            { Id: 'conversation-current', Title: '本月服务质量概览', Archived: false, LastTime: '2026-07-22 21:18:00', MessageCount: 4 },
            { Id: 'conversation-archived', Title: '上季度客户增长复盘', Archived: true, LastTime: '2026-07-18 09:20:00', MessageCount: 6 }
          ]
        }
      };
    }
    if (action === 'conversation') {
      return {
        Code: 1,
        Data: {
          ConversationId: body.ConversationId,
          Messages: [
            { Id: 'history-user-1', Role: 'user', Content: '请分析本月服务质量', Thinking: [] },
            { Id: 'history-ai-1', Role: 'assistant', Content: '本月服务完成率稳定，建议优先处理临期任务。', Thinking: ['已校验数据权限', '已汇总服务指标'] }
          ]
        }
      };
    }
    if (['rename', 'archive', 'restore'].includes(action)) {
      return { Code: 1, Data: { ConversationId: body.ConversationId, Title: body.Title || '', Archived: action === 'archive' } };
    }
    return {
      Code: 1,
      Data: {
        Answer: '本月本人负责的售后任务整体运行平稳，建议优先处理临近计划时间的任务。',
        Thinking: ['已验证当前角色权限', '已限定本人负责数据', '已完成服务指标汇总'],
        ConversationId: body.ConversationId || 'conversation-new',
        RequestId: body.RequestId || 'request-new',
        Title: body.Title || '新对话',
        ModelId: 'model-001',
        ModelName: 'Microi.AI中转站',
        RuntimeModel: body.RelayModel || 'MiniMax-M3'
      }
    };
  }
  if (lowerUrl.includes('my_some_count') || lowerUrl.includes('apiengine')) {
    return { Code: 1, Data: { orderCount: 28, ShebeiCount: 143, FuwuCount: 56 } };
  }
  return { Code: 1, Data: [], DataCount: 0 };
}

async function installApiMock(cdp) {
  cdp.on('Fetch.requestPaused', async (event) => {
    const response = buildMockResponse(event.request || {});
    const status = response && response.status ? response.status : 200;
    const payload = typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'body') ? response.body : response;
    await cdp.send('Fetch.fulfillRequest', {
      requestId: event.requestId,
      responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Headers', value: '*' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }
      ],
      body: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)).toString('base64')
    });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://api.jifulii.com/*', requestStage: 'Request' }] });
}

async function waitForSelector(cdp, selector, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`, returnByValue: true
    });
    if (result.result && result.result.value) return;
    await delay(200);
  }
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => ({
      url: location.href,
      text: String(document.body && document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 500),
      classes: [...document.querySelectorAll('body *')].slice(0, 40).map((item) => item.className).filter(Boolean)
    }))()`,
    returnByValue: true
  });
  const detail = diagnostics.result && diagnostics.result.value;
  fail(`Selector did not render: ${selector}; page=${JSON.stringify(detail || {})}`);
}

async function waitForExpression(cdp, expression, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.result && result.result.value) return result.result.value;
    await delay(180);
  }
  fail(`Expression did not become true: ${expression}`);
}

async function testBusinessListReturn(cdp, appPort) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?visual=${Date.now()}#/pages/business/catalog` });
  await waitForSelector(cdp, '.catalog-page .entry-row');
  await delay(350);
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.catalog-page .entry-row').click()` });
  await waitForSelector(cdp, '.list-page .data-card');

  const scrollToEnd = `(() => {
    const host = document.querySelector('.data-scroll');
    const candidates = host ? [host, ...host.querySelectorAll('*')].filter((item) => item.scrollHeight > item.clientHeight + 4) : [];
    const scroll = candidates[0] || (host && (host.querySelector('.uni-scroll-view') || host));
    if (!scroll) return 0;
    scroll.scrollTop = scroll.scrollHeight;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    let component = document.querySelector('.list-page').__vueParentComponent;
    while (component && !(component.proxy && typeof component.proxy.loadMore === 'function')) component = component.parent;
    if (component && component.proxy) component.proxy.loadMore();
    return document.querySelectorAll('.data-card').length;
  })()`;
  for (let index = 0; index < 4; index += 1) {
    await cdp.send('Runtime.evaluate', { expression: scrollToEnd, returnByValue: true });
    await delay(650);
    const count = await cdp.send('Runtime.evaluate', { expression: `document.querySelectorAll('.data-card').length`, returnByValue: true });
    if (Number(count.result && count.result.value) >= 38) break;
  }
  await waitForExpression(cdp, `document.querySelectorAll('.data-card').length >= 38`);

  const before = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const host = document.querySelector('.data-scroll');
      const candidates = host ? [host, ...host.querySelectorAll('*')].filter((item) => item.scrollHeight > item.clientHeight + 4) : [];
      const scroll = candidates[0] || (host && (host.querySelector('.uni-scroll-view') || host));
      const card = document.querySelectorAll('.data-card')[37];
      card.scrollIntoView({ block: 'center' });
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
      const top = scroll.scrollTop;
      card.click();
      return { top, count: document.querySelectorAll('.data-card').length };
    })()`
  });
  await waitForSelector(cdp, '.detail-page');
  await cdp.send('Runtime.evaluate', { expression: 'history.back()' });
  await waitForSelector(cdp, '.list-page .data-card');
  await delay(500);

  const returned = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const host = document.querySelector('.data-scroll');
      const candidates = host ? [host, ...host.querySelectorAll('*')].filter((item) => item.scrollHeight > item.clientHeight + 4) : [];
      const scroll = candidates[0] || (host && (host.querySelector('.uni-scroll-view') || host));
      return { top: scroll ? scroll.scrollTop : -1, count: document.querySelectorAll('.data-card').length };
    })()`
  });
  const beforeValue = before.result.value;
  const returnedValue = returned.result.value;
  if (returnedValue.count < 38 || Math.abs(returnedValue.top - beforeValue.top) > 100) {
    fail(`List detail return lost position: before=${JSON.stringify(beforeValue)}, returned=${JSON.stringify(returnedValue)}`);
  }

  await cdp.send('Runtime.evaluate', { expression: `location.hash = '#/pages/business/catalog'` });
  await waitForSelector(cdp, '.catalog-page .entry-row');
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.catalog-page .entry-row').click()` });
  await waitForSelector(cdp, '.list-page .data-card');
  await delay(350);
  const fresh = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const host = document.querySelector('.data-scroll');
      const candidates = host ? [host, ...host.querySelectorAll('*')].filter((item) => item.scrollHeight > item.clientHeight + 4) : [];
      const scroll = candidates[0] || (host && (host.querySelector('.uni-scroll-view') || host));
      return { top: scroll ? scroll.scrollTop : -1, count: document.querySelectorAll('.data-card').length };
    })()`
  });
  if (fresh.result.value.count > 20 || fresh.result.value.top > 10) {
    fail(`Fresh list entry did not reset to page 1: ${JSON.stringify(fresh.result.value)}`);
  }
  console.log(`PASS business-list-return -> restored row 38 at ${Math.round(returnedValue.top)}px; fresh entry page 1.`);
}

async function testPeriodFiltersAndRefresh(cdp, appPort) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?visual=${Date.now()}#/pages/business/list?key=customers` });
  await waitForSelector(cdp, '.list-page .data-card');
  await waitForExpression(cdp, `document.body.innerText.includes('去年')`);
  const clickPeriod = async (label) => {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const element = [...document.querySelectorAll('.period-item')].find((item) => item.innerText.includes(${JSON.stringify(label)})); if (!element) return false; element.click(); return true; })()`,
      returnByValue: true
    });
    await waitForExpression(cdp, `[...document.querySelectorAll('.period-item.active')].some((item) => item.innerText.includes(${JSON.stringify(label)}))`);
    await delay(350);
    return (await cdp.send('Runtime.evaluate', {
      expression: `Number((document.querySelector('.summary-value') || {}).innerText || -1)`, returnByValue: true
    })).result.value;
  };
  const today = await clickPeriod('本日');
  const month = await clickPeriod('本月');
  if (today !== 2 || month !== 9 || today === month) {
    fail(`Business period filter did not change statistics: today=${today}, month=${month}`);
  }

  const beforeRequests = mockRequestLog.filter((item) => /moduleengine\/gettabledata/i.test(item.url) && item.table === 'Diy_Kehu').length;
  const refreshState = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      let component = document.querySelector('.list-page').__vueParentComponent;
      while (component && !(component.proxy && typeof component.proxy.refresh === 'function')) component = component.parent;
      if (!component || !component.proxy) return { found: false };
      await component.proxy.refresh();
      return { found: true, refreshing: component.proxy.refreshing, loading: component.proxy.loading };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  const afterRequests = mockRequestLog.filter((item) => /moduleengine\/gettabledata/i.test(item.url) && item.table === 'Diy_Kehu').length;
  if (!refreshState.result.value.found || refreshState.result.value.refreshing || refreshState.result.value.loading || afterRequests <= beforeRequests) {
    fail(`Business pull refresh did not finish or reload: ${JSON.stringify({ state: refreshState.result.value, beforeRequests, afterRequests })}`);
  }

  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?visual=${Date.now()}#/pages/task/list` });
  await waitForSelector(cdp, '.task-page .task-card');
  await waitForExpression(cdp, `document.body.innerText.includes('去年') && [...document.querySelectorAll('.type-chip')].some((item) => item.innerText.replace(/\\s/g, '') === '安装1') && [...document.querySelectorAll('.type-chip')].some((item) => item.innerText.replace(/\\s/g, '') === '维修2')`);
  const title = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const item = document.querySelector('.mci-page-shell__title'); return { text: item.innerText, clipped: item.scrollWidth > item.clientWidth + 1, width: item.clientWidth }; })()`,
    returnByValue: true
  });
  if (title.result.value.text !== '售后任务' || title.result.value.clipped) {
    fail(`Task title is clipped: ${JSON.stringify(title.result.value)}`);
  }
  console.log(`PASS period-filter-refresh -> business 2/9, task type counts, 去年, refresh completion, full title.`);
}

async function setLoggedInState(cdp) {
  const user = {
    Id: 'user-001', Account: 'admin', Name: '张服务', Phone: '13900001234',
    RoleName: '售后服务工程师', TenantId: 'tenant-xjy', TenantName: '集福鲤杭州运营中心',
    DeptId: 'dept-service', DeptName: '客户服务部', Level: 10
  };
  await cdp.send('Runtime.evaluate', {
    expression: `localStorage.setItem('microi_token', 'xjy-visual-token'); localStorage.setItem('microi_user', ${JSON.stringify(JSON.stringify(user))});`,
    returnByValue: true
  });
}

async function inspectLayout(cdp, target, viewport) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const required = ${JSON.stringify(target.required)};
      const forbiddenSelectors = ${JSON.stringify(target.forbiddenSelectors || [])};
      const expectedSafe = ${JSON.stringify(viewport.safe || {})};
      const missing = required.filter((selector) => !document.querySelector(selector));
      const presentForbiddenSelectors = forbiddenSelectors.filter((selector) => document.querySelector(selector));
      const invisible = required.filter((selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width < 2 || rect.height < 2 || style.display === 'none' || style.visibility === 'hidden';
      });
      const root = document.querySelector(${JSON.stringify(target.selectorAfterClick || target.selector)});
      const rootRect = root ? root.getBoundingClientRect() : null;
      const bodyText = (document.body.innerText || '').trim();
      const globalForbiddenText = ['[object Object]', '["浙江省"', '"CreateTime":', '<p>', '</p>'];
      const forbiddenText = ([...globalForbiddenText, ...${JSON.stringify(target.forbiddenText || [])}]).filter((text) => bodyText.includes(text));
      const failedImages = ${JSON.stringify(Boolean(target.requireLoadedImages))} && root
        ? [...root.querySelectorAll('img')].filter((image) => image.src && image.complete && image.naturalWidth === 0).map((image) => image.src)
        : [];
      const visibleTabBar = ${JSON.stringify(Boolean(target.requireHiddenTabBar))}
        ? [...document.querySelectorAll('uni-tabbar, .uni-tabbar, .uni-tabbar-bottom')].some((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
          })
        : false;
      const composer = ${JSON.stringify(Boolean(target.requireVisibleComposer))} ? document.querySelector('.ai-assistant__composer') : null;
      const composerRect = composer ? composer.getBoundingClientRect() : null;
      const composerClipped = !!composerRect && (composerRect.bottom > innerHeight + 1 || composerRect.top < 0 || composerRect.height < 48);
      const panel = ${JSON.stringify(Boolean(target.requireFullscreenPanel))} ? document.querySelector('.ai-assistant__panel') : null;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const fullscreenPanel = !${JSON.stringify(Boolean(target.requireFullscreenPanel))} || !!panelRect &&
        Math.abs(panelRect.left) <= 1 && Math.abs(panelRect.top) <= 1 &&
        Math.abs(panelRect.right - innerWidth) <= 1 && Math.abs(panelRect.bottom - innerHeight) <= 1;
      const heroVideoHost = ${JSON.stringify(Boolean(target.requireHeroVideo))} && root ? root.querySelector('.mci-water-motion__video') : null;
      const heroVideoRect = heroVideoHost ? heroVideoHost.getBoundingClientRect() : null;
      const heroVideoReady = !${JSON.stringify(Boolean(target.requireHeroVideo))} || !!heroVideoRect &&
        heroVideoRect.width > 20 && heroVideoRect.height > 20;
      const horizontalOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
      const bottom = document.querySelector('.bottom-actions');
      const scroll = document.querySelector('.detail-scroll');
      const bottomRect = bottom ? bottom.getBoundingClientRect() : null;
      const scrollRect = scroll ? scroll.getBoundingClientRect() : null;
      const bottomOverlap = bottomRect && scrollRect ? Math.max(0, scrollRect.bottom - bottomRect.top) : 0;
      const rootStyle = root ? getComputedStyle(root) : null;
      const safe = {
        top: rootStyle ? parseFloat(rootStyle.getPropertyValue('--mci-safe-top')) || 0 : 0,
        bottom: rootStyle ? parseFloat(rootStyle.getPropertyValue('--mci-safe-bottom')) || 0 : 0,
        left: rootStyle ? parseFloat(rootStyle.getPropertyValue('--mci-safe-left')) || 0 : 0,
        right: rootStyle ? parseFloat(rootStyle.getPropertyValue('--mci-safe-right')) || 0 : 0,
        capsuleRight: rootStyle ? parseFloat(rootStyle.getPropertyValue('--mci-capsule-right')) || 0 : 0
      };
      const safeMatches = ['top', 'bottom', 'left', 'right', 'capsuleRight'].every((key) =>
        Math.abs(Number(safe[key] || 0) - Number(expectedSafe[key] || 0)) <= 1
      );
      const header = document.querySelector('.home-header, .profile-hero, .search-header, .news-header, .msg-header, .page-header, .page-nav, .catalog-header, .camera-nav, .login-nav');
      const headerPaddingTop = header ? parseFloat(getComputedStyle(header).paddingTop) || 0 : 0;
      const safeTopApplied = !header || Number(expectedSafe.top || 0) === 0 || headerPaddingTop + 1 >= Number(expectedSafe.top || 0);
      const fixedBottom = document.querySelector('.bottom-actions, .bottom-bar, .submit-bar, .camera-controls, .chat-input-area, .popup-footer');
      const fixedBottomPadding = fixedBottom ? parseFloat(getComputedStyle(fixedBottom).paddingBottom) || 0 : 0;
      const safeBottomApplied = !fixedBottom || Number(expectedSafe.bottom || 0) === 0 || fixedBottomPadding + 1 >= Number(expectedSafe.bottom || 0);
      const expectedTextMissing = ${JSON.stringify(target.expectedText || [])}.filter((text) => !bodyText.includes(text));
      const titles = [...document.querySelectorAll('.mci-page-shell__title, .nav-title')];
      const clippedTitles = titles.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => ({ text: element.innerText, width: element.clientWidth, scrollWidth: element.scrollWidth }));
      const capsuleRect = {
        left: innerWidth - Number(expectedSafe.capsuleRight || 0),
        right: innerWidth,
        top: Number(expectedSafe.capsuleTop || 0),
        bottom: Number(expectedSafe.capsuleTop || 0) + Number(expectedSafe.capsuleHeight || 0)
      };
      const capsuleTargets = [...document.querySelectorAll('.ai-assistant__identity, .ai-assistant__header-actions .ai-assistant__icon-button, .ai-assistant__drawer-close')];
      const requireCapsuleAvoidance = ${JSON.stringify(Boolean(target.requireCapsuleAvoidance))};
      const collidingCapsuleTargets = !requireCapsuleAvoidance ? [] : capsuleTargets.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > capsuleRect.left && rect.left < capsuleRect.right && rect.bottom > capsuleRect.top && rect.top < capsuleRect.bottom;
      });
      return {
        ok: Boolean(root) && missing.length === 0 && presentForbiddenSelectors.length === 0 && invisible.length === 0 && forbiddenText.length === 0 && failedImages.length === 0 && expectedTextMissing.length === 0 && clippedTitles.length === 0 && collidingCapsuleTargets.length === 0 && horizontalOverflow <= 2 && bottomOverlap <= 2 && safeMatches && safeTopApplied && safeBottomApplied && !visibleTabBar && !composerClipped && fullscreenPanel && heroVideoReady,
        missing, presentForbiddenSelectors, invisible, forbiddenText, failedImages, expectedTextMissing, clippedTitles, horizontalOverflow, bottomOverlap, visibleTabBar, composerClipped,
        fullscreenPanel, panelRect, heroVideoReady, heroVideoRect, capsuleRect,
        capsuleCollisions: collidingCapsuleTargets.map((element) => ({ className: element.className, rect: element.getBoundingClientRect().toJSON() })),
        safe, expectedSafe, safeMatches, safeTopApplied, safeBottomApplied, headerPaddingTop, fixedBottomPadding,
        viewport: { width: window.innerWidth, height: window.innerHeight }, rootRect,
        bodyTextLength: bodyText.length
      };
    })()`
  });
  return result.result.value;
}

async function verifyHeroVideo(cdp, target) {
  if (!target.requireHeroVideo) return null;
  const readFrame = async () => {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const scope = document.querySelector(${JSON.stringify(target.selector)});
        const host = scope && scope.querySelector('.mci-water-motion__video');
        const video = host && (host.matches('video') ? host : host.querySelector('video'));
        if (!host) return null;
        const rect = host.getBoundingClientRect();
        return {
          src: String((video && video.currentSrc) || host.getAttribute('src') || ''),
          currentTime: Number((video && video.currentTime) || 0),
          paused: video ? Boolean(video.paused) : null,
          readyState: Number((video && video.readyState) || 0),
          width: rect.width,
          height: rect.height
        };
      })()`,
      returnByValue: true
    });
    return result.result.value;
  };
  const before = await readFrame();
  await delay(520);
  const after = await readFrame();
  const expectedSource = 'jifuli-water-ripples-360x640.mp4';
  if (!before || !after || !after.src.includes(expectedSource) || after.width < 20 || after.height < 20) {
    fail(`Hero water video is unavailable for ${target.name}: ${JSON.stringify({ before, after })}`);
  }
  if (after.readyState >= 2 && after.paused === false && after.currentTime <= before.currentTime) {
    fail(`Hero water video is not advancing for ${target.name}: ${JSON.stringify({ before, after })}`);
  }
  return { before, after };
}

function waitForProcessExit(child, timeoutMs = 2500) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  if (!fs.existsSync(path.join(h5Root, 'index.html'))) fail('H5 build is missing. Run npm run build:h5 first.');
  const browserPath = findBrowser();
  if (!browserPath) fail('Chrome or Edge was not found.');

  fs.mkdirSync(outputRoot, { recursive: true });
  const appPort = await getFreePort();
  const debugPort = await getFreePort();
  const server = createStaticServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xjy-uniapp-visual-'));
  let browser;
  let cdp;
  const report = [];
  const browserErrors = [];
  let currentContext = 'startup';

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(appPort, '127.0.0.1', resolve);
    });
    browser = spawn(browserPath, [
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`,
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--hide-scrollbars', 'about:blank'
    ], { stdio: 'ignore' });
    cdp = await connectCdp(await waitForDebugger(debugPort));
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', (event) => {
      const detail = event.exceptionDetails || {};
      browserErrors.push({ context: currentContext, type: 'exception', text: detail.text || 'Uncaught exception' });
    });
    cdp.on('Runtime.consoleAPICalled', (event) => {
      if (!['error', 'assert'].includes(event.type)) return;
      const text = (event.args || []).map((item) => item.value || item.description || '').filter(Boolean).join(' ');
      browserErrors.push({ context: currentContext, type: event.type, text });
    });
    await installApiMock(cdp);

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
    await waitForSelector(cdp, 'body');
    await setLoggedInState(cdp);

    for (const viewport of activeViewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale,
        mobile: true, screenWidth: viewport.width, screenHeight: viewport.height
      });
      await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 244, g: 248, b: 250, a: 1 }
      });
      for (const target of activeTargets) {
        currentContext = `${target.name}/${viewport.name}`;
        const errorStart = browserErrors.length;
        if (target.name === 'login' || target.anonymous) {
          await cdp.send('Runtime.evaluate', {
            expression: `localStorage.removeItem('microi_token'); localStorage.removeItem('microi_user');`,
            returnByValue: true
          });
        } else {
          await setLoggedInState(cdp);
        }
        const route = target.route.startsWith('/#') ? target.route.slice(1) : target.route;
        const safe = viewport.safe || {};
        const safeQuery = [
          'visualSafe=1',
          `safeTop=${Number(safe.top || 0)}`,
          `safeBottom=${Number(safe.bottom || 0)}`,
          `safeLeft=${Number(safe.left || 0)}`,
          `safeRight=${Number(safe.right || 0)}`,
          `capsuleRight=${Number(safe.capsuleRight || 0)}`,
          `capsuleTop=${Number(safe.capsuleTop || 0)}`,
          `capsuleHeight=${Number(safe.capsuleHeight || 0)}`,
          `windowWidth=${viewport.width}`,
          `windowHeight=${viewport.height}`
        ].join('&');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?visual=${Date.now()}&${safeQuery}${route}` });
        await waitForSelector(cdp, target.selector);
        await delay(900);
        if (target.clickSelector) {
          const interactionTarget = await cdp.send('Runtime.evaluate', {
            expression: `(() => { const element = document.querySelector(${JSON.stringify(target.clickSelector)}); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`,
            returnByValue: true
          });
          const point = interactionTarget.result && interactionTarget.result.value;
          if (!point) fail(`Interaction target did not render: ${target.clickSelector}`);
          if (target.touchTap) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
            await delay(80);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await delay(180);
            const touchResult = await cdp.send('Runtime.evaluate', {
              expression: `!!document.querySelector(${JSON.stringify(target.afterSelector || target.selector)})`,
              returnByValue: true
            });
            // Chromium H5 does not consistently synthesize Vue's `tap` event
            // after CDP touch input. Keep touch as the primary path and use a
            // DOM click only when that H5-specific bridge did not fire.
            if (!(touchResult.result && touchResult.result.value)) {
              await cdp.send('Runtime.evaluate', {
                expression: `document.querySelector(${JSON.stringify(target.clickSelector)}).click()`,
                returnByValue: true
              });
            }
          } else {
            await cdp.send('Runtime.evaluate', {
              expression: `document.querySelector(${JSON.stringify(target.clickSelector)}).click()`,
              returnByValue: true
            });
          }
          await waitForSelector(cdp, target.afterSelector || target.selector);
          await delay(450);
        }
        if (target.secondClickSelector) {
          await cdp.send('Runtime.evaluate', {
            expression: `document.querySelector(${JSON.stringify(target.secondClickSelector)}).click()`,
            returnByValue: true
          });
          await waitForSelector(cdp, target.afterSecondSelector || target.selector);
          await delay(450);
        }
        await cdp.send('Runtime.evaluate', {
          expression: `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`,
          awaitPromise: true,
          returnByValue: true
        });
        const layout = await inspectLayout(cdp, target, viewport);
        const waterMotion = await verifyHeroVideo(cdp, target);
        const fileName = `${target.name}-${viewport.name}.png`;
        const screenshotPath = path.join(outputRoot, fileName);
        // Prime Chromium's compositor after rapid full-page navigations. Without
        // this warm capture, headless mode can intermittently omit safe-area
        // backgrounds or the final Chinese glyph on the first rendered frame.
        await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await delay(220);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        const fileSize = fs.statSync(screenshotPath).size;
        const routeErrors = browserErrors.slice(errorStart);
        const allowedPatterns = target.allowedErrorPatterns || [];
        const expectedBrowserErrors = routeErrors.filter((item) => allowedPatterns.some((pattern) => item.text.includes(pattern)));
        const unexpectedBrowserErrors = routeErrors.filter((item) => !allowedPatterns.some((pattern) => item.text.includes(pattern)));
        const result = {
          target: target.name, viewport: viewport.name, screenshotPath, fileSize, layout,
          waterMotion, browserErrors: unexpectedBrowserErrors, expectedBrowserErrors
        };
        report.push(result);
        if (!layout || !layout.ok) fail(`Layout check failed for ${target.name} at ${viewport.name}: ${JSON.stringify(layout)}`);
        if (unexpectedBrowserErrors.length) fail(`Browser error for ${target.name} at ${viewport.name}: ${JSON.stringify(unexpectedBrowserErrors)}`);
        if (fileSize < 12000 || layout.bodyTextLength < 20) fail(`Screenshot appears blank for ${target.name} at ${viewport.name}.`);
        console.log(`PASS ${target.name} ${viewport.name} -> ${screenshotPath}`);
      }
    }

    currentContext = 'business-list-return';
    await testBusinessListReturn(cdp, appPort);
    currentContext = 'period-filter-refresh';
    await testPeriodFiltersAndRefresh(cdp, appPort);

    fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
    console.log(`Visual delivery check passed: ${report.length} screenshots.`);
  } finally {
    if (cdp) cdp.close();
    if (browser && !browser.killed) browser.kill();
    await waitForProcessExit(browser);
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (error) {}
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
