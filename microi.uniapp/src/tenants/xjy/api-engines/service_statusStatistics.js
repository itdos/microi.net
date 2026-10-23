/*
 * V8 ApiEngine
 * ApiEngineKey: service_statusStatistics
 * Version: v1.1.1
 * Function:
 * - 按任务责任范围、客户、类型、关键词和时间统计各状态数量；规范化业务参数以隔离宿主属性，兼容聚合列别名大小写
 */

// HTTP 省略空类型后，JObject 的 Type 属性可能被 param.type 读到，造成虚假的任务类型条件。
// 只规范化业务参数，当前用户仍取服务端权威身份，不能从请求恢复。
var param = JSON.parse(JSON.stringify(V8.Param || {}));
var currentUser = V8.CurrentUser || {};
var level = Number(currentUser.Level || 0);
var mineOnly = param.isClicked === true || param.isClicked === 1 || String(param.isClicked || '').toLowerCase() === 'true';
var taskScope = ['todo', 'participated', 'all'].indexOf(String(param.taskScope || '')) >= 0
  ? String(param.taskScope) : (mineOnly ? 'todo' : 'all');
var dateFields = ['YuyueSJ', 'ShangmenSJ', 'YujiSHSJ', 'FinishTime', 'JiedanSJ'];
var stateDefinitions = [
  { Key: 'pending', Name: '待接单' },
  { Key: 'TodoCount', Name: '待服务' },
  { Key: 'acceptance', Name: '待客服验收' },
  { Key: 'cacceptance', Name: '待客户验收' },
  { Key: 'evaluated', Name: '待评价' },
  { Key: 'FinishCount', Name: '已结束' },
  { Key: 'cancel', Name: '已取消' },
  { Key: 'suspend', Name: '暂停' }
];

function hasRange(value) {
  return value && typeof value.length === 'number' && value.length >= 2 && value[0] && value[1];
}

function executeGroupedSql() {
  var clauses = ['IFNULL(IsDeleted, 0) = 0'];
  var values = [];

  function add(expression, value) {
    var name = '@p' + values.length;
    clauses.push(expression.replace('?', name));
    values.push({ Name: name, Value: value });
  }
  if (taskScope !== 'all') {
    if (!currentUser.Id || !currentUser.TenantId) return [];
    add('TenantId = ?', currentUser.TenantId);
    if (taskScope === 'participated') {
      var serviceParam = '@p' + values.length;
      values.push({ Name: serviceParam, Value: currentUser.Id });
      var supportParam = '@p' + values.length;
      values.push({ Name: supportParam, Value: currentUser.Id });
      clauses.push('(ShouhouRYID = ' + serviceParam + ' OR HouxuFZRID = ' + supportParam + ')');
    } else {
      var serviceParam = '@p' + values.length;
      values.push({ Name: serviceParam, Value: currentUser.Id });
      var supportParam = '@p' + values.length;
      values.push({ Name: supportParam, Value: currentUser.Id });
      clauses.push('((ZhuangtaiZ IN (1,2,10) AND ShouhouRYID = ' + serviceParam + ') OR (ZhuangtaiZ = 11 AND HouxuFZRID = ' + supportParam + '))');
    }
  }
  if (param.city) add('Chengshi LIKE ?', '%' + String(param.city) + '%');
  if (param.KehuId) add('KehuID = ?', param.KehuId);
  if (param.type) add('Leixing = ?', param.type);
  if (param.keyword) {
    var keyword = '%' + String(param.keyword) + '%';
    var keywordParts = [];
    var keywordFields = ['KehuMC', 'ShouhouFWBH', 'DingdanBH', 'Leixing', 'ShouhouRY', 'Neirong', 'Chengshi', 'Dizhi'];
    for (var k = 0; k < keywordFields.length; k++) {
      var parameterName = '@p' + values.length;
      keywordParts.push(keywordFields[k] + ' LIKE ' + parameterName);
      values.push({ Name: parameterName, Value: keyword });
    }
    clauses.push('(' + keywordParts.join(' OR ') + ')');
  }
  for (var i = 0; i < dateFields.length; i++) {
    var range = param[dateFields[i]];
    if (hasRange(range)) {
      add(dateFields[i] + ' >= ?', range[0]);
      add(dateFields[i] + ' <= ?', range[1]);
      break;
    }
  }

  var command = V8.Db.FromSql(
    "SELECT COALESCE(Zhuangtai, '') AS GroupValue, COUNT(1) AS GroupCount " +
    'FROM Diy_ShouhouDD WHERE ' + clauses.join(' AND ') +
    " GROUP BY COALESCE(Zhuangtai, '')"
  );
  for (var p = 0; p < values.length; p++) {
    command = command.AddInParameter(values[p].Name, values[p].Value);
  }
  return command.ToArray();
}

function moduleCount(stateName) {
  var where = [];
  if (taskScope === 'participated') where.push(
    { GroupStart: true, Name: 'ShouhouRYID', Value: currentUser.Id, Type: '=' },
    { AndOr: 'OR', Name: 'HouxuFZRID', Value: currentUser.Id, Type: '=', GroupEnd: true }
  );
  if (taskScope === 'todo') where.push(
    { GroupStart: true, Name: 'ZhuangtaiZ', Value: [1, 2, 10], Type: 'In' },
    { Name: 'ShouhouRYID', Value: currentUser.Id, Type: '=' },
    { AndOr: 'OR', Name: 'ZhuangtaiZ', Value: 11, Type: '=' },
    { Name: 'HouxuFZRID', Value: currentUser.Id, Type: '=', GroupEnd: true }
  );
  if (param.city) where.push({ Name: 'Chengshi', Value: param.city, Type: 'Like' });
  if (param.KehuId) where.push({ Name: 'KehuID', Value: param.KehuId, Type: '=' });
  if (param.type) where.push({ Name: 'Leixing', Value: param.type, Type: '=' });
  where.push({ Name: 'Zhuangtai', Value: stateName, Type: 'Like' });

  var dateTime = {};
  for (var i = 0; i < dateFields.length; i++) dateTime[dateFields[i]] = param[dateFields[i]] || [];
  var result = V8.ModuleEngine.GetTableData({
    ModuleEngineKey: 'Diy_ShouhouDD',
    _CurrentUser: currentUser,
    _Keyword: param.keyword || '',
    _Where: where,
    _SearchDateTime: dateTime,
    _PageIndex: 1,
    _PageSize: 1
  });
  return result && result.Code == 1 ? Number(result.DataCount || 0) : 0;
}

var data = {};
var grouped = null;
if (taskScope !== 'all' || level >= 999) {
  try {
    grouped = executeGroupedSql();
  } catch (error) {
    console.log('service_statusStatistics grouped query fallback: ' + error);
  }
}

if (grouped) {
  for (var d = 0; d < stateDefinitions.length; d++) data[stateDefinitions[d].Key] = 0;
  for (var g = 0; g < grouped.length; g++) {
    // 数据库返回的聚合别名可能全小写，缺失别名不能被误当成状态为空或数量为零。
    var groupName = grouped[g].GroupValue;
    if (groupName === undefined) groupName = grouped[g].groupValue;
    if (groupName === undefined) groupName = grouped[g].groupvalue;
    var groupCount = grouped[g].GroupCount;
    if (groupCount === undefined) groupCount = grouped[g].groupCount;
    if (groupCount === undefined) groupCount = grouped[g].groupcount;
    groupName = String(groupName || '');
    groupCount = Number(groupCount || 0);
    for (var s = 0; s < stateDefinitions.length; s++) {
      if (groupName.indexOf(stateDefinitions[s].Name) >= 0) {
        data[stateDefinitions[s].Key] += groupCount;
        break;
      }
    }
  }
} else {
  for (var i = 0; i < stateDefinitions.length; i++) {
    data[stateDefinitions[i].Key] = moduleCount(stateDefinitions[i].Name);
  }
}

V8.Result = { Code: 1, Data: data };
