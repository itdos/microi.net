/**
 * 接口引擎：获取集福鲤平台数据库结构信息
 * 用途：获取diy_table、diy_field、sys_config、sys_menu表的所有数据，供AI学习数据库结构
 * 接口Key：get-database-jifuli
 * 允许匿名：否
 * 自定义地址：/apiengine/get-database-jifuli
 * 项目名称：集福鲤平台
 */

//【第一步】查询diy_table表（数据库所有表及说明，字段Name为动态表名）
var tableResult = V8.FormEngine.GetTableData('diy_table', {
  _PageSize: 9999,
  _OrderBy: 'Name',
  _OrderByType: 'ASC'
});

if (tableResult.Code != 1) {
  return {
    Code: 0,
    Msg: '获取diy_table表信息失败：' + tableResult.Msg
  };
}

//【第二步】查询diy_field表（数据库所有字段及说明，字段Name为动态字段名，字段TableId为关联diy_table表的Id）
var fieldResult = V8.FormEngine.GetTableData('diy_field', {
  _PageSize: 99999,
  _OrderBys: {
    'TableId': 'ASC',
    'Sort': 'ASC',
    'Name': 'ASC'
  }
});

if (fieldResult.Code != 1) {
  return {
    Code: 0,
    Msg: '获取diy_field表信息失败：' + fieldResult.Msg
  };
}

//【第三步】查询sys_config表（系统设置）
var configResult = V8.FormEngine.GetTableData('sys_config', {
  _PageSize: 9999,
  _OrderBy: 'Id',
  _OrderByType: 'ASC'
});

if (configResult.Code != 1) {
  return {
    Code: 0,
    Msg: '获取sys_config表信息失败：' + configResult.Msg
  };
}

//【第四步】查询sys_menu表（菜单模块）
var menuResult = V8.FormEngine.GetTableData('sys_menu', {
  _PageSize: 9999,
  _OrderBys: {
    'Sort': 'ASC',
    'Id': 'ASC'
  }
});

if (menuResult.Code != 1) {
  return {
    Code: 0,
    Msg: '获取sys_menu表信息失败：' + menuResult.Msg
  };
}

//【第五步】整理数据结构，将字段按表分组
var tableMap = {};
var tableIdMap = {}; // 用于通过TableId快速查找表信息

for (var i = 0; i < tableResult.Data.length; i++) {
  var table = tableResult.Data[i];
  var tableName = table.Name; // 字段Name为动态表名
  var tableId = table.Id;
  
  tableMap[tableName] = {
    TableInfo: table,
    Fields: []
  };
  
  tableIdMap[tableId] = tableName;
}

//将字段信息归类到对应的表（字段Name为动态字段名，字段TableId为关联diy_table表的Id）
for (var j = 0; j < fieldResult.Data.length; j++) {
  var field = fieldResult.Data[j];
  var fieldTableId = field.TableId; // 字段TableId关联diy_table表的Id
  
  // 通过TableId找到对应的表名
  var relatedTableName = tableIdMap[fieldTableId];
  
  if (relatedTableName && tableMap[relatedTableName]) {
    tableMap[relatedTableName].Fields.push(field);
  }
}

//【第六步】生成统计信息
var statistics = {
  TableCount: tableResult.DataCount || tableResult.Data.length,
  FieldCount: fieldResult.DataCount || fieldResult.Data.length,
  ConfigCount: configResult.DataCount || configResult.Data.length,
  MenuCount: menuResult.DataCount || menuResult.Data.length
};

//【第七步】返回完整的集福鲤平台数据库结构信息
return {
  Code: 1,
  Msg: '获取集福鲤平台数据库结构成功！',
  Data: {
    // 数据库所有表及说明（字段Name为动态表名）
    DiyTables: tableResult.Data,
    // 数据库所有字段及说明（字段Name为动态字段名，字段TableId为关联diy_table表的Id）
    DiyFields: fieldResult.Data,
    // 系统设置
    SysConfig: configResult.Data,
    // 菜单模块
    SysMenu: menuResult.Data,
    // 按表分组的结构化数据（便于AI分析）
    TableMap: tableMap,
    // 统计信息
    Statistics: statistics
  },
  DataAppend: {
    ProjectName: '集福鲤平台',
    GenerateTime: V8.Action.GetDateTimeNow(),
    Tips: '集福鲤平台数据库结构信息已成功获取，包含diy_table、diy_field、sys_config、sys_menu四张表的完整数据，可提供给AI进行学习分析'
  }
};
