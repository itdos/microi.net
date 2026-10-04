/*
 * V8 ApiEngine
 * ApiEngineKey: xjy-customer-contract-totals
 * Version: v1.0.1
 * Function:
 * - 只读批量汇总当前账号可见客户的租赁、买断、包年换芯合同商品金额。
 * - CustomerIds 最多50个；CustomerSysMenuId 必须是真实客户菜单。
 * - 普通HTTP表单列表验证客户与订单范围，再参数化读取授权订单并聚合商品。
 * - 全部金额含已审批/已到期历史；当前金额要求已审批、未断约及合同日期含边界。
 * - 不写客户、订单、商品或合同状态；权限、截断、异常与未知金额均明确失败。
 */

var API_BASE = 'https://api.jifulii.com';
var PAGE_SIZE = 1000;
var MAX_ORDERS = 5000;

// 数组来自参数代理，不能用 Array.isArray 判断；只接受有界字符串Id集合。
function readCustomerIds(input) {
  if (!input || typeof input === 'string' || !Number.isInteger(Number(input.length)) || input.length < 1 || input.length > 50) throw new Error('客户编号必须为1至50项的数组');
  var ids = [];
  var seen = Object.create(null);
  for (var i = 0; i < input.length; i++) {
    if (typeof input[i] !== 'string') throw new Error('客户编号格式不正确');
    var id = input[i].trim();
    if (!id || id.length > 128 || /[\u0000-\u001f]/.test(id)) throw new Error('客户编号格式不正确');
    if (!seen[id]) { seen[id] = true; ids.push(id); }
  }
  return ids;
}

// 认证只能从可信原请求的活动会话获取，绝不接收参数中的身份或Token。
function readTrustedHeaders() {
  if (String(V8.OsClient || '').toLowerCase() !== 'xjy' || !V8.CurrentUser || !V8.CurrentUser.Id) throw new Error('当前租户或登录身份不正确');
  var session = V8.Method.GetCurrentToken();
  if (!session || !session.CurrentUser || String(session.CurrentUser.Id) !== String(V8.CurrentUser.Id) || String(session.OsClient || '').toLowerCase() !== 'xjy') throw new Error('当前登录会话不可用');
  var token = String(session.Token || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || /[\r\n]/.test(token)) throw new Error('当前登录会话不可用');
  return { Authorization: 'Bearer ' + token, osclient: 'xjy' };
}

// 独立HTTP请求经过可信Controller的普通Client授权；V8内部FormEngine不承担该边界。
function readAuthorizedPage(table, menuId, where, page, headers) {
  var payload = {
    FormEngineKey: table, _Where: where, _SelectFields: ['Id'],
    _PageIndex: page, _PageSize: PAGE_SIZE, _OrderBy: 'Id', _OrderByType: 'asc', _IsTree: false
  };
  if (menuId) payload._SysMenuId = menuId;
  var response = V8.Http.PostResponse({
    Url: API_BASE + '/api/FormEngine/GetTableData', Headers: headers,
    ParamType: 'json', PostParamString: JSON.stringify(payload), Timeout: 10
  });
  if (!response || !Number.isFinite(Number(response.StatusCode)) || Number(response.StatusCode) < 200 || Number(response.StatusCode) >= 300 || response.ErrorMessage) throw new Error('合同金额授权读取失败');
  var result;
  try { result = JSON.parse(String(response.Content || '')); } catch (error) { throw new Error('合同金额授权响应格式不正确'); }
  if (!result || Number(result.Code) !== 1 || !Array.isArray(result.Data)) throw new Error(result && result.Msg ? String(result.Msg) : '当前账号没有客户或合同查看权限');
  var count = Number(result.DataCount);
  if (result.DataCount === null || result.DataCount === undefined || !Number.isInteger(count) || count < 0) throw new Error('合同金额授权响应缺少完整总数');
  return { rows: result.Data, count: count };
}

// 分页针对整批订单而非逐客户查询；最多5页，任何截断或变化均失败关闭。
function readAuthorizedIds(table, menuId, where, maximum, headers) {
  var ids = [];
  var seen = Object.create(null);
  var total = -1;
  for (var page = 1; page <= Math.ceil(maximum / PAGE_SIZE) + 1; page++) {
    var result = readAuthorizedPage(table, menuId, where, page, headers);
    if (result.count > maximum) throw new Error('合同数量超过安全查询上限，请缩小客户范围');
    if (total !== -1 && total !== result.count) throw new Error('合同授权范围发生变化，请重试');
    total = result.count;
    var expected = Math.min(PAGE_SIZE, total - ids.length);
    if (result.rows.length !== expected) throw new Error('合同金额授权结果被截断，请重试');
    for (var i = 0; i < result.rows.length; i++) {
      var id = typeof result.rows[i].Id === 'string' ? result.rows[i].Id.trim() : '';
      if (!id || seen[id]) throw new Error('合同金额授权结果重复或缺少编号');
      seen[id] = true;
      ids.push(id);
    }
    if (ids.length === total) return ids;
  }
  throw new Error('合同金额授权结果未完整读取');
}

// 日期仅使用合同字段；服务起止字段属于另一业务周期，不作为当前合同的替代。
function contractDay(value) {
  var day = String(value || '').trim().substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  var year = Number(day.substring(0, 4));
  var month = Number(day.substring(5, 7));
  var date = Number(day.substring(8, 10));
  var parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day : '';
}

// 仅生成参数占位符，所有真实Id使用AddInParameter绑定，不拼接业务值到SQL。
function placeholders(values, bindings) {
  var names = [];
  for (var i = 0; i < values.length; i++) {
    var name = '@p' + bindings.length;
    bindings.push({ name: name, value: values[i] });
    names.push(name);
  }
  return names.join(',');
}

// 两次固定批量SQL只读取HTTP已授权的订单，不读取发布方或其它租户数据库。
function queryRows(sql, bindings) {
  var query = V8.Db.FromSql(sql);
  for (var i = 0; i < bindings.length; i++) query = query.AddInParameter(bindings[i].name, bindings[i].value);
  var rows = query.ToArray();
  if (!rows || !Number.isInteger(Number(rows.length))) throw new Error('合同金额数据库读取失败');
  return rows;
}

// 数据库已经按decimal聚合；不再乘数量或使用订单总价，避免组合合同漏计或重复计费。
function money(value) {
  if (value === null || value === undefined || String(value).trim() === '') throw new Error('合同商品金额不完整');
  var amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > 90071992547409.91) throw new Error('合同商品金额不合法');
  return amount.toFixed(2);
}

// 无授权订单的客户允许真实零值；读取失败不能走到这个成功返回。
function emptyTotals() {
  return { Rental: { Current: '0.00', All: '0.00' }, Buyout: { All: '0.00' }, AnnualFilter: { Current: '0.00', All: '0.00' } };
}

try {
  var customerIds = readCustomerIds(V8.Param.CustomerIds);
  var customerMenuId = String(V8.Param.CustomerSysMenuId || '').trim();
  if (!customerMenuId || customerMenuId.length > 128) throw new Error('缺少有效客户菜单授权上下文');
  var headers = readTrustedHeaders();
  var authorizedCustomers = readAuthorizedIds('Diy_Kehu', customerMenuId, [['Id', 'In', customerIds]], 50, headers);
  var requested = Object.create(null);
  for (var c = 0; c < customerIds.length; c++) requested[customerIds[c]] = true;
  if (authorizedCustomers.length !== customerIds.length) throw new Error('部分客户不存在或不在当前账号可见范围');
  for (var a = 0; a < authorizedCustomers.length; a++) if (!requested[authorizedCustomers[a]]) throw new Error('客户授权范围不正确');

  // 未指定订单菜单时，普通HTTP仍按当前用户已授权同表菜单/精确Read权限合并数据范围。
  var orderIds = readAuthorizedIds('Diy_Dingdan', '', [
    ['KehuID', 'In', customerIds],
    ['AND', '(', 'DingdanZT', '=', '已审批'], ['OR', 'DingdanZT', '=', '已到期', ')']
  ], MAX_ORDERS, headers);
  var today = contractDay(DateNow('yyyy-MM-dd'));
  if (!today) throw new Error('服务端合同日期不可用');
  var customers = Object.create(null);
  for (var e = 0; e < customerIds.length; e++) customers[customerIds[e]] = emptyTotals();

  if (orderIds.length) {
    var orderBindings = [];
    var orderIn = placeholders(orderIds, orderBindings);
    var customerIn = placeholders(customerIds, orderBindings);
    var orders = queryRows('SELECT o.Id,o.KehuID,o.DingdanZT,o.HetongZT,o.HetongKSSJ,o.HetongJSSJ FROM Diy_Dingdan o WHERE COALESCE(o.IsDeleted,0)=0 AND o.Id IN (' + orderIn + ') AND o.KehuID IN (' + customerIn + ") AND o.DingdanZT IN ('已审批','已到期')", orderBindings);
    if (orders.length !== orderIds.length) throw new Error('合同记录发生变化或读取不完整，请重试');
    var currentIds = [];
    var seenOrders = Object.create(null);
    var authorizedOrders = Object.create(null);
    for (var ao = 0; ao < orderIds.length; ao++) authorizedOrders[orderIds[ao]] = true;
    for (var o = 0; o < orders.length; o++) {
      var order = orders[o];
      var orderId = String(order.Id || '');
      if (!authorizedOrders[orderId] || seenOrders[orderId] || !requested[String(order.KehuID || '')]) throw new Error('合同关联或授权范围不正确');
      if (order.DingdanZT === undefined || order.HetongZT === undefined || order.HetongKSSJ === undefined || order.HetongJSSJ === undefined) throw new Error('合同字段读取不完整');
      seenOrders[orderId] = true;
      var start = contractDay(order.HetongKSSJ);
      var end = contractDay(order.HetongJSSJ);
      if (order.DingdanZT === '已审批' && order.HetongZT === '未断约' && start && end && start <= today && today <= end) currentIds.push(orderId);
    }

    var bindings = [];
    var allowedIn = placeholders(orderIds, bindings);
    var relatedIn = placeholders(customerIds, bindings);
    var current = currentIds.length ? 'x.DingdanID IN (' + placeholders(currentIds, bindings) + ')' : '1=0';
    // 标签优先；仅标签为空时兼容当前租户真实字典 1/2/3/4/5/ShiJi。
    var kind = "CASE WHEN TRIM(COALESCE(p.HezuoFS,''))<>'' THEN TRIM(p.HezuoFS) WHEN p.HezuoFSZ='1' THEN '买断' WHEN p.HezuoFSZ='2' THEN '租赁' WHEN p.HezuoFSZ='3' THEN '包年换芯' WHEN p.HezuoFSZ='4' THEN '买断+包年换芯' WHEN p.HezuoFSZ='5' THEN '赠送' WHEN p.HezuoFSZ='ShiJi' THEN '试机' ELSE '未知合作方式' END";
    var sql = "SELECT x.KehuID," +
      "SUM(CASE WHEN x.Kind='租赁' THEN x.Zongjia ELSE 0 END) AS RentalAll," +
      "SUM(CASE WHEN x.Kind='租赁' AND (" + current + ") THEN x.Zongjia ELSE 0 END) AS RentalCurrent," +
      "SUM(CASE WHEN x.Kind IN ('买断','买断+包年换芯') THEN x.Zongjia ELSE 0 END) AS BuyoutAll," +
      "SUM(CASE WHEN x.Kind IN ('包年换芯','买断+包年换芯') THEN x.LvxinZJ ELSE 0 END) AS AnnualAll," +
      "SUM(CASE WHEN x.Kind IN ('包年换芯','买断+包年换芯') AND (" + current + ") THEN x.LvxinZJ ELSE 0 END) AS AnnualCurrent," +
      "SUM(CASE WHEN x.Kind NOT IN ('租赁','买断','包年换芯','买断+包年换芯','赠送','试机') THEN 1 ELSE 0 END) AS UnknownCount," +
      "SUM(CASE WHEN (x.Kind IN ('租赁','买断','买断+包年换芯') AND x.Zongjia IS NULL) OR (x.Kind IN ('包年换芯','买断+包年换芯') AND x.LvxinZJ IS NULL) THEN 1 ELSE 0 END) AS MissingAmountCount " +
      "FROM (SELECT o.KehuID,p.DingdanID,p.Zongjia,p.LvxinZJ," + kind + " AS Kind FROM Diy_DingdanSP p INNER JOIN Diy_Dingdan o ON o.Id=p.DingdanID WHERE COALESCE(p.IsDeleted,0)=0 AND COALESCE(o.IsDeleted,0)=0 AND o.Id IN (" + allowedIn + ") AND o.KehuID IN (" + relatedIn + ") AND o.DingdanZT IN ('已审批','已到期')) x GROUP BY x.KehuID";
    var totals = queryRows(sql, bindings);
    var seenCustomers = Object.create(null);
    for (var t = 0; t < totals.length; t++) {
      var row = totals[t];
      var id = String(row.KehuID || '');
      if (!requested[id] || seenCustomers[id]) throw new Error('合同金额汇总范围不正确');
      if (Number(row.UnknownCount) !== 0 || Number(row.MissingAmountCount) !== 0) throw new Error('合同商品合作方式或金额不完整，请核对后重试');
      seenCustomers[id] = true;
      customers[id] = { Rental: { Current: money(row.RentalCurrent), All: money(row.RentalAll) }, Buyout: { All: money(row.BuyoutAll) }, AnnualFilter: { Current: money(row.AnnualCurrent), All: money(row.AnnualAll) } };
    }
  }
  return {
    Code: 1, Data: {
      Customers: customers, AsOf: today,
      Scope: '仅汇总当前账号可见的已审批和已到期合同商品；包含已断约历史，不含待审批、作废、赠送和试机',
      CurrentDefinition: '当前有效合同：已审批、未断约，且合同开始日期≤今天≤合同结束日期；缺少或无效合同日期不计当前，服务日期不替代合同日期'
    }, Msg: ''
  };
} catch (error) {
  // 不记录认证头或原始异常堆栈，也不以空汇总掩盖授权/网络/数据库失败。
  return { Code: 0, Msg: error && error.message ? String(error.message) : '合同金额查询失败' };
}
