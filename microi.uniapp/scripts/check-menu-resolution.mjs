import assert from 'node:assert/strict'
import {
  requiresAuthorizedMenuContext,
  resolveBusinessMenuPermission,
  selectAuthorizedMenu
} from '../src/platform/menu-resolution.mjs'

const parentMenu = {
  Id: '26011406-298b-44f8-b7c9-32975fb4d447',
  Name: '订单管理',
  DiyTableId: ''
}
const orderMenu = {
  Id: 'fc56123e-cfa1-4690-a6a4-929f202a817b',
  Name: '合同订单',
  DiyTableId: 'bf52f9ef-8fb9-482a-9271-0445f075c58b'
}
const aliases = ['合同订单', '订单管理', '我的订单']

assert.equal(
  selectAuthorizedMenu([parentMenu, orderMenu], {
    aliases,
    tableName: 'Diy_Dingdan'
  })?.Id,
  orderMenu.Id,
  '父目录排在前面时，仍应选择绑定订单表的合同订单菜单'
)

assert.equal(
  selectAuthorizedMenu([parentMenu, orderMenu], {
    aliases,
    tableName: 'Diy_Dingdan',
    tableId: orderMenu.DiyTableId
  })?.Id,
  orderMenu.Id,
  '已知订单表 Id 时应严格按表绑定选择菜单'
)

assert.equal(
  selectAuthorizedMenu([parentMenu], {
    aliases,
    tableName: 'Diy_Dingdan'
  }),
  null,
  '找不到业务子菜单时必须失败关闭，不能把父目录作为 _SysMenuId'
)

assert.equal(
  selectAuthorizedMenu([parentMenu, orderMenu], {
    aliases
  })?.Id,
  orderMenu.Id,
  '未指定业务表时仍按别名配置顺序选择业务菜单'
)

assert.equal(
  selectAuthorizedMenu([parentMenu, orderMenu], {
    aliases,
    tableName: 'Diy_Dingdan',
    menuId: parentMenu.Id
  })?.Id,
  orderMenu.Id,
  '历史链接携带父目录 Id 时应重新解析为订单业务菜单'
)

const attendanceMenu = {
  Id: 'attendance-card-menu',
  Name: '打卡记录',
  DiyTableId: 'location-table'
}
const locationMenu = {
  Id: 'location-file-menu',
  Name: '人员定位',
  DiyTableId: 'location-table'
}

assert.equal(
  selectAuthorizedMenu([attendanceMenu, locationMenu], {
    aliases: ['人员定位'],
    tableName: 'Diy_location',
    tableId: 'location-table',
    preferAliases: true
  })?.Id,
  locationMenu.Id,
  '文件访问菜单应能在同表多个菜单中按指定别名精确选择'
)

const customerCaseMenu = {
  Id: 'customer-case-menu',
  Name: '客户案例',
  DiyTableId: 'customer-case-table'
}
const customerMenu = {
  Id: 'customer-menu',
  Name: '客户',
  DiyTableId: 'customer-table'
}

assert.equal(
  selectAuthorizedMenu([customerCaseMenu], {
    aliases: ['客户', '客户管理', '我的客户'],
    tableName: 'Diy_Kehu'
  }),
  null,
  '菜单树缺少表名时，“客户”不得模糊命中“客户案例”'
)

assert.equal(
  selectAuthorizedMenu([customerCaseMenu, customerMenu], {
    aliases: ['客户', '客户管理', '我的客户'],
    tableName: 'Diy_Kehu'
  })?.Id,
  customerMenu.Id,
  '菜单树缺少表名时仍应允许精确别名命中真实客户菜单'
)

const nativeCustomerModule = {
  target: 'native-list',
  table: 'Diy_Kehu',
  menuAliases: ['客户', '客户管理', '我的客户']
}
assert.equal(requiresAuthorizedMenuContext(nativeCustomerModule), true, '原生动态列表必须要求真实菜单上下文')
assert.deepEqual(
  resolveBusinessMenuPermission({}, nativeCustomerModule),
  { table: 'Diy_Kehu', menuAliases: nativeCustomerModule.menuAliases },
  '原生动态列表入口显隐必须复用表和菜单别名权限'
)
assert.equal(
  requiresAuthorizedMenuContext({ ...nativeCustomerModule, listApiEngineKey: 'customer-list' }),
  false,
  '独立接口引擎列表不应被误判为模块引擎菜单'
)

console.log('菜单权限上下文解析检查通过')
