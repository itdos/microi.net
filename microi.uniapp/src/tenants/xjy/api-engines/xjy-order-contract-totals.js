/*
 * V8 ApiEngine
 * ApiEngineKey: xjy-order-contract-totals
 * Version: v1.0.2
 * Function:
 * - 按合同订单菜单权限和完整筛选只读汇总状态、合同商品与订单金额；有效期口径沿用客户管理。
 */

var API_BASE = 'https://api.jifulii.com';
var MENU_ID = 'fc56123e-cfa1-4690-a6a4-929f202a817b';
var PAGE_SIZE = 1000;
var MAX_ORDERS = 20000;

// 不接收客户端身份或Token；只将当前租户活动会话交回普通Client授权入口。
function trustedHeaders() {
  if (String(V8.OsClient || '').toLowerCase() !== 'xjy' || !V8.CurrentUser || !V8.CurrentUser.Id) throw new Error('当前租户或登录身份不正确');
  var session = V8.Method.GetCurrentToken();
  if (!session || !session.CurrentUser || String(session.CurrentUser.Id) !== String(V8.CurrentUser.Id) || String(session.OsClient || '').toLowerCase() !== 'xjy') throw new Error('当前登录会话不可用');
  var token = String(session.Token || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || /[\r\n]/.test(token)) throw new Error('当前登录会话不可用');
  return { Authorization: 'Bearer ' + token, osclient: 'xjy' };
}

// 分页是整个筛选范围的有界批量读取，非逐客户/逐订单查询；截断、重复、总数变化均失败关闭。
function authorizedOrders(menuId, filters, headers) {
  var rows = [], seen = Object.create(null), total = -1;
  for (var page = 1; page <= MAX_ORDERS / PAGE_SIZE + 1; page++) {
    var payload = { FormEngineKey: 'Diy_Dingdan', _SysMenuId: menuId,
      _Where: filters._Where || [], _Keyword: String(filters._Keyword || ''),
      _SelectFields: ['Id', 'DingdanZT'], _PageIndex: page, _PageSize: PAGE_SIZE,
      _OrderBy: 'Id', _OrderByType: 'asc', _IsTree: false };
    for (var key of ['_Search', '_SearchEqual', '_SearchDateTime', '_SearchNumber']) {
      if (filters[key]) payload[key] = filters[key];
    }
    var response = V8.Http.PostResponse({ Url: API_BASE + '/api/FormEngine/GetTableData',
      Headers: headers, ParamType: 'json', PostParamString: JSON.stringify(payload), Timeout: 10 });
    if (!response || Number(response.StatusCode) < 200 || Number(response.StatusCode) >= 300 || !Number.isFinite(Number(response.StatusCode)) || response.ErrorMessage) throw new Error('订单统计授权读取失败');
    var result;
    try { result = JSON.parse(String(response.Content || '')); } catch (error) { throw new Error('订单统计授权响应格式不正确'); }
    if (!result || Number(result.Code) !== 1 || !Array.isArray(result.Data)) throw new Error(result && result.Msg ? String(result.Msg) : '当前账号没有合同订单查看权限');
    var count = Number(result.DataCount);
    if (result.DataCount === null || result.DataCount === undefined || !Number.isInteger(count) || count < 0 || count > MAX_ORDERS) throw new Error('订单数量超限或响应不完整，请缩小筛选范围');
    if (total !== -1 && total !== count) throw new Error('订单统计范围发生变化，请重试');
    total = count;
    if (result.Data.length !== Math.min(PAGE_SIZE, total - rows.length)) throw new Error('订单统计结果被截断，请重试');
    for (var i = 0; i < result.Data.length; i++) {
      var row = result.Data[i], id = String(row.Id || '').trim();
      if (!id || id.length > 128 || seen[id] || row.DingdanZT === undefined) throw new Error('订单统计字段不完整或重复');
      seen[id] = true;
      rows.push({ Id: id, DingdanZT: String(row.DingdanZT || '') });
    }
    if (rows.length === total) return rows;
  }
  throw new Error('订单统计范围未完整读取');
}

function contractDay(value) {
  var day = String(value || '').trim().substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  var year = Number(day.substring(0, 4)), month = Number(day.substring(5, 7)), date = Number(day.substring(8, 10));
  var parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day : '';
}

function placeholders(values, bindings) {
  var names = [];
  for (var i = 0; i < values.length; i++) {
    var name = '@p' + bindings.length;
    bindings.push({ name: name, value: values[i] });
    names.push(name);
  }
  return names.join(',');
}

function queryRows(sql, bindings) {
  var query = V8.Db.FromSql(sql);
  for (var i = 0; i < bindings.length; i++) query = query.AddInParameter(bindings[i].name, bindings[i].value);
  var rows = query.ToArray();
  if (!rows || !Number.isInteger(Number(rows.length))) throw new Error('订单金额数据库读取失败');
  return rows;
}

function cents(value) {
  var amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > 90071992547409.91) throw new Error('订单金额不合法');
  return Math.round(amount * 100);
}

try {
  var menuId = String(V8.Param.SysMenuId || V8.Param._SysMenuId || '').trim();
  if (menuId !== MENU_ID) throw new Error('缺少有效合同订单菜单授权上下文');
  var filters = V8.Param.Filters || {};
  var validity = filters.ValidOnly === undefined || filters.ValidOnly === null ? V8.Param.ValidOnly : filters.ValidOnly;
  var validOnly = !(validity === false || String(validity) === 'false' || String(validity) === '0');
  var rows = authorizedOrders(menuId, filters.BadgeFilters || filters, trustedHeaders());
  var statusCounts = Object.create(null), selectedIds = [], selected = Object.create(null);
  statusCounts.All = rows.length;
  var selectedStatus = String(filters.SelectedStatus || '');
  for (var i = 0; i < rows.length; i++) {
    var state = rows[i].DingdanZT;
    statusCounts[state] = (statusCounts[state] || 0) + 1;
    if (!selectedStatus || state === selectedStatus) {
      selectedIds.push(rows[i].Id);
      selected[rows[i].Id] = state;
    }
  }
  var today = contractDay(DateNow('yyyy-MM-dd'));
  if (!today) throw new Error('服务端合同日期不可用');
  var amounts = { rental: 0, buyout: 0, annualFilter: 0, sum: 0 };
  var incomplete = { rental: 0, buyout: 0, annualFilter: 0, sum: 0 };
  if (selectedIds.length) {
    var bindings = [], allowedIn = placeholders(selectedIds, bindings);
    var orders = queryRows('SELECT o.Id,o.DingdanZT,o.HetongZT,o.HetongKSSJ,o.HetongJSSJ,o.DingdanJE FROM Diy_Dingdan o WHERE COALESCE(o.IsDeleted,0)=0 AND o.Id IN (' + allowedIn + ')', bindings);
    if (orders.length !== selectedIds.length) throw new Error('合同记录发生变化，请重试');
    var allIds = [], currentIds = [], seenOrders = Object.create(null);
    for (var o = 0; o < orders.length; o++) {
      var order = orders[o], id = String(order.Id || '');
      if (selected[id] === undefined || seenOrders[id] || order.DingdanZT === undefined || selected[id] !== String(order.DingdanZT || '')) throw new Error('合同授权范围或状态发生变化，请重试');
      seenOrders[id] = true;
      if (order.HetongZT === undefined || order.HetongKSSJ === undefined || order.HetongJSSJ === undefined || order.DingdanJE === undefined) throw new Error('合同字段读取不完整');
      // 订单金额合计保持列表全状态汇总，只遵循当前筛选，不参与有效期开关。
      if (order.DingdanJE === null || String(order.DingdanJE).trim() === '') incomplete.sum++;
      else amounts.sum += cents(order.DingdanJE);
      if (order.DingdanZT !== '已审批' && order.DingdanZT !== '已到期') continue;
      allIds.push(id);
      var start = contractDay(order.HetongKSSJ), end = contractDay(order.HetongJSSJ);
      var current = order.DingdanZT === '已审批' && order.HetongZT === '未断约' && start && end && start <= today && today <= end;
      if (current) currentIds.push(id);
    }
    if (allIds.length) {
      bindings = [];
      allowedIn = placeholders(allIds, bindings);
      var currentSql = currentIds.length ? 'p.DingdanID IN (' + placeholders(currentIds, bindings) + ')' : '1=0';
      // 沿用客户管理：设备总价不重复乘数量，组合合同分别归入设备买断与滤芯金额。
      var kind = "CASE WHEN TRIM(COALESCE(p.HezuoFS,''))<>'' THEN TRIM(p.HezuoFS) WHEN p.HezuoFSZ='1' THEN '买断' WHEN p.HezuoFSZ='2' THEN '租赁' WHEN p.HezuoFSZ='3' THEN '包年换芯' WHEN p.HezuoFSZ='4' THEN '买断+包年换芯' WHEN p.HezuoFSZ='5' THEN '赠送' WHEN p.HezuoFSZ='ShiJi' THEN '试机' ELSE '未知合作方式' END";
      var equipment = "CASE WHEN p.Zongjia IS NOT NULL THEN p.Zongjia WHEN (" + kind + ") IN ('买断','买断+包年换芯') AND p.ShebeiSJDJ IS NOT NULL AND p.Shuliang IS NOT NULL AND p.ShebeiSJDJ>=0 AND p.Shuliang>=0 THEN ROUND(p.ShebeiSJDJ*p.Shuliang,2) ELSE NULL END";
      var rental = "x.Kind='租赁'" + (validOnly ? ' AND x.CurrentValid=1' : '');
      var buyout = "x.Kind IN ('买断','买断+包年换芯')";
      var annual = "x.Kind IN ('包年换芯','买断+包年换芯')" + (validOnly ? ' AND x.CurrentValid=1' : '');
      var unknown = "x.Kind NOT IN ('租赁','买断','包年换芯','买断+包年换芯','赠送','试机')";
      var sql = 'SELECT ' +
        'SUM(CASE WHEN ' + rental + ' THEN x.Zongjia ELSE 0 END) AS rental,' +
        'SUM(CASE WHEN ' + buyout + ' THEN x.Zongjia ELSE 0 END) AS buyout,' +
        'SUM(CASE WHEN ' + annual + ' THEN x.LvxinZJ ELSE 0 END) AS annualFilter,' +
        'SUM(CASE WHEN (' + rental + ' AND x.Zongjia IS NULL) OR (' + unknown + (validOnly ? ' AND x.CurrentValid=1' : '') + ') THEN 1 ELSE 0 END) AS MissingRental,' +
        'SUM(CASE WHEN (' + buyout + ' AND x.Zongjia IS NULL) OR (' + unknown + ') THEN 1 ELSE 0 END) AS MissingBuyout,' +
        'SUM(CASE WHEN (' + annual + ' AND x.LvxinZJ IS NULL) OR (' + unknown + (validOnly ? ' AND x.CurrentValid=1' : '') + ') THEN 1 ELSE 0 END) AS MissingAnnual ' +
        'FROM (SELECT ' + equipment + ' AS Zongjia,p.LvxinZJ,' + kind + ' AS Kind,CASE WHEN ' + currentSql + ' THEN 1 ELSE 0 END AS CurrentValid ' +
        "FROM Diy_DingdanSP p INNER JOIN Diy_Dingdan o ON o.Id=p.DingdanID WHERE COALESCE(p.IsDeleted,0)=0 AND COALESCE(o.IsDeleted,0)=0 AND o.DingdanZT IN ('已审批','已到期') AND o.Id IN (" + allowedIn + ')) x';
      var totals = queryRows(sql, bindings);
      if (totals.length !== 1) throw new Error('合同商品汇总响应不完整');
      for (var metric of ['rental', 'buyout', 'annualFilter']) {
        if (totals[0][metric] === undefined) throw new Error('合同商品金额字段不完整');
        amounts[metric] = cents(totals[0][metric] === null ? 0 : totals[0][metric]);
      }
      incomplete.rental = Number(totals[0].MissingRental || 0);
      incomplete.buyout = Number(totals[0].MissingBuyout || 0);
      incomplete.annualFilter = Number(totals[0].MissingAnnual || 0);
    }
  }
  var metrics = {};
  for (var key in amounts) {
    if (!Number.isSafeInteger(amounts[key])) throw new Error('合同汇总金额超过安全范围');
    metrics[key] = (amounts[key] / 100).toFixed(2);
  }
  // 保留原PC合作中/已作废分类页签，同时让它们复用本接口的批量授权统计。
  var buttons = {};
  buttons['827068c8-2261-4637-882f-ad0f19f7f641'] = statusCounts.All;
  buttons['b010f86f-954f-4b99-bd14-c3e63feebb22'] = (statusCounts['待审批'] || 0) + (statusCounts['已审批'] || 0) + (statusCounts['已驳回'] || 0);
  buttons['01KWZP2X53ECEMTKQVZZEGH60R'] = (statusCounts['待审批作废'] || 0) + (statusCounts['已作废'] || 0) + (statusCounts['已到期'] || 0);
  return { Code: 1, Data: { Metrics: metrics, IncompleteMetrics: incomplete, StatusCounts: statusCounts,
    Buttons: buttons, ValidOnly: validOnly, AsOf: today }, Msg: '' };
} catch (error) {
  return { Code: 0, Msg: error && error.message ? String(error.message) : '合同订单统计失败' };
}
