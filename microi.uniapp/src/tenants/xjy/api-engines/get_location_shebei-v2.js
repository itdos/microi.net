/*
 * V8 ApiEngine
 * ApiEngineKey: get_location_shebei-v2
 * Version: v1.1.2
 * Function:
 * - 设备地图：在既有租户与责任权限内按附近1至6000公里或省市区（含全国/全部）查询，支持分批加载；按任务ID查询保持原权限与坐标兜底。
 */

var taskId = String(V8.Param.TaskId || '').trim();
var currentUser = V8.CurrentUser || {};
var tenantId = String(currentUser.TenantId || '').trim();
var currentUserId = String(currentUser.Id || '').trim();
if (!currentUserId || !tenantId) {
  V8.Result = { Code: 0, Data: [], DataCount: 0, Msg: '登录信息或租户信息无效' };
  return;
}
var currentRoleNames = String(currentUser.RoleName || '')
  .replace(/[，；;]/g, ',')
  .split(',')
  .map(function (item) { return item.trim(); })
  .filter(function (item) { return !!item; });
var canViewAllTenantDevices = Number(currentUser.Level || 0) >= 998 ||
  currentRoleNames.indexOf('客服') >= 0 ||
  currentRoleNames.indexOf('客服主管') >= 0 ||
  currentRoleNames.indexOf('售后主管') >= 0;

if (taskId) {
  var userId = currentUserId;
  var roleNames = String(currentUser.RoleName || '')
    .replace(/[，；;]/g, ',')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(function (item) { return !!item; });
  var broadServiceRole = roleNames.indexOf('客服') >= 0 ||
    roleNames.indexOf('客服主管') >= 0 ||
    roleNames.indexOf('售后主管') >= 0;
  var level = Number(currentUser.Level || 0);
  var taskSql = `SELECT
      COALESCE(A.Id, T.KehuSBID) AS Id,
      COALESCE(NULLIF(A.KehuID, ''), D.KehuID) AS KehuID,
      COALESCE(NULLIF(A.KehuMC, ''), D.KehuMC) AS KehuMC,
      COALESCE(NULLIF(A.ShebeiBH, ''), T.ShebeiBH) AS ShebeiBH,
      COALESCE(NULLIF(A.ShangpinMC, ''), T.ShebeiMC) AS ShangpinMC,
      COALESCE(NULLIF(A.ShebeiXH, ''), T.ShebeiXH) AS ShebeiXH,
      COALESCE(NULLIF(T.AnzhuangWZ, ''), A.AnzhuangWZ) AS AnzhuangWZ,
      CASE
        WHEN T.AnzhuangWZ_Lat IS NOT NULL AND T.AnzhuangWZ_Lat <> '' AND T.AnzhuangWZ_Lat <> '0'
          AND T.AnzhuangWZ_Lng IS NOT NULL AND T.AnzhuangWZ_Lng <> '' AND T.AnzhuangWZ_Lng <> '0'
          THEN T.AnzhuangWZ_Lat
        WHEN A.KehuSB_Lat IS NOT NULL AND A.KehuSB_Lat <> '' AND A.KehuSB_Lat <> '0'
          AND A.KehuSB_Lng IS NOT NULL AND A.KehuSB_Lng <> '' AND A.KehuSB_Lng <> '0'
          THEN A.KehuSB_Lat
        ELSE C.KehuDT_Lat
      END AS KehuSB_Lat,
      CASE
        WHEN T.AnzhuangWZ_Lat IS NOT NULL AND T.AnzhuangWZ_Lat <> '' AND T.AnzhuangWZ_Lat <> '0'
          AND T.AnzhuangWZ_Lng IS NOT NULL AND T.AnzhuangWZ_Lng <> '' AND T.AnzhuangWZ_Lng <> '0'
          THEN T.AnzhuangWZ_Lng
        WHEN A.KehuSB_Lat IS NOT NULL AND A.KehuSB_Lat <> '' AND A.KehuSB_Lat <> '0'
          AND A.KehuSB_Lng IS NOT NULL AND A.KehuSB_Lng <> '' AND A.KehuSB_Lng <> '0'
          THEN A.KehuSB_Lng
        ELSE C.KehuDT_Lng
      END AS KehuSB_Lng,
      CASE
        WHEN T.AnzhuangWZ_Lat IS NOT NULL AND T.AnzhuangWZ_Lat <> '' AND T.AnzhuangWZ_Lat <> '0'
          AND T.AnzhuangWZ_Lng IS NOT NULL AND T.AnzhuangWZ_Lng <> '' AND T.AnzhuangWZ_Lng <> '0'
          THEN 'task-device'
        WHEN A.KehuSB_Lat IS NOT NULL AND A.KehuSB_Lat <> '' AND A.KehuSB_Lat <> '0'
          AND A.KehuSB_Lng IS NOT NULL AND A.KehuSB_Lng <> '' AND A.KehuSB_Lng <> '0'
          THEN 'customer-device'
        ELSE 'customer-default'
      END AS CoordinateSource,
      A.ShebeiZT,
      T.Id AS TaskDeviceId,
      T.FuwuZT,
      T.FuwuZTZ
    FROM Diy_ShouhouSP T
    INNER JOIN Diy_ShouhouDD D
      ON D.Id = T.ShouhouDDID AND D.IsDeleted = 0
    LEFT JOIN Diy_KehuSB A
      ON (A.Id = T.KehuSBID
        OR ((T.KehuSBID IS NULL OR T.KehuSBID = '') AND A.ShebeiBH = T.ShebeiBH))
      AND A.IsDeleted = 0
      AND A.TenantId = D.TenantId
    LEFT JOIN Diy_Kehu C
      ON C.Id = COALESCE(NULLIF(A.KehuID, ''), D.KehuID)
      AND C.IsDeleted = 0
      AND C.TenantId = D.TenantId
    WHERE T.IsDeleted = 0
      AND T.ShouhouDDID = @p0
      AND D.TenantId = @p1
      AND (
        @p5 = 1
        OR D.KehuZHID = @p2
        OR A.KehuZHID = @p2
        OR C.KehuZHID = @p2
        OR D.ShouhouRYID = @p2
        OR D.UserId = @p2
        OR C.FuzeRID = @p2
        OR C.ShouhouRYID = @p2
        OR C.ZhuanshuKFID = @p2
        OR @p6 = 1
      )`;
  var taskQuery = V8.Db.FromSql(taskSql)
    .AddInParameter('@p0', taskId)
    .AddInParameter('@p1', tenantId)
    .AddInParameter('@p2', userId)
    .AddInParameter('@p5', level > 997 ? 1 : 0)
    .AddInParameter('@p6', broadServiceRole ? 1 : 0);
  var taskDevices = taskQuery.ToArray();
  V8.Result = { Code: 1, Data: taskDevices, DataCount: taskDevices.length, Msg: '' };
  return;
}

// 省市区查询不依赖手机定位，也不叠加附近半径；两条路径共用下方租户与责任权限。
var regional = String(V8.Param.Scope || 'nearby') === 'region';
var regionNames = [];
if (regional) {
  var region;
  try { region = JSON.parse(typeof V8.Param.Region === 'string' ? V8.Param.Region : JSON.stringify(V8.Param.Region)); } catch (error) {}
  if (!Array.isArray(region) || !region.length || region.length > 3) return { Code: 0, Msg: '请选择有效省市区' };
  for (var ri = 0; ri < region.length; ri++) {
    var name = String(region[ri] || '').trim();
    if (!name || name.length > 80) return { Code: 0, Msg: '省市区参数无效' };
    if (name === '全部') break;
    regionNames.push(name);
  }
}
var latitude = regional ? 0 : Number(V8.Param.Latitude);
var longitude = regional ? 0 : Number(V8.Param.Longitude);
var km = Number(V8.Param.Km || 10);
if (!isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !isFinite(longitude) || longitude < -180 || longitude > 180) {
  V8.Result = { Code: 0, Msg: '经纬度参数错误！' };
  return;
}
if (!isFinite(km) || km <= 0) km = 10;
if (km > 6000) km = 6000;

var nearbySql = `SELECT * FROM (
    SELECT
      A.Id,
      A.KehuID,
      A.KehuMC,
      A.ShebeiBH,
      A.ShangpinMC,
      A.ShebeiXH,
      A.AnzhuangWZ,
      A.KehuSB_Lat,
      A.KehuSB_Lng,
      C.Chengshi,
      CASE
        WHEN A.KehuZHID = @p5 OR C.KehuZHID = @p5 THEN 'customer'
        ELSE 'staff'
      END AS DeviceAccessScope,
      A.ShebeiZT,
      (6371 * acos(
        cos(radians(@p0))
        * cos(radians(A.KehuSB_Lat))
        * cos(radians(A.KehuSB_Lng) - radians(@p1))
        + sin(radians(@p0))
        * sin(radians(A.KehuSB_Lat))
      )) AS distance
    FROM Diy_KehuSB A
    LEFT JOIN Diy_Kehu C
      ON C.Id = A.KehuID
      AND C.IsDeleted = 0
      AND C.TenantId = A.TenantId
    WHERE A.IsDeleted = 0
      AND A.KehuSB_Lat IS NOT NULL AND A.KehuSB_Lat <> '' AND A.KehuSB_Lat <> '0'
      AND A.KehuSB_Lng IS NOT NULL AND A.KehuSB_Lng <> '' AND A.KehuSB_Lng <> '0'
      AND A.TenantId = @p3
      AND (
        @p4 = 1
        OR A.UserId = @p5
        OR C.FuzeRID = @p5
        OR C.ShouhouRYID = @p5
        OR C.ZhuanshuKFID = @p5
        OR A.KehuZHID = @p5
        OR C.KehuZHID = @p5
      )`;
// 使用绑定参数的子串匹配兼容 JSON 数组和历史文本城市；不把用户值拼入 SQL。
for (var rn = 0; rn < regionNames.length; rn++) nearbySql += ' AND INSTR(C.Chengshi, @region' + rn + ') > 0';
nearbySql += regional ? ') AS distances' : ') AS distances WHERE distance <= @p2';
var paged = regional || V8.Param.PageIndex != null;
var pageIndex = Math.max(1, Math.floor(Number(V8.Param.PageIndex) || 1));
var pageSize = Math.min(500, Math.max(1, Math.floor(Number(V8.Param.PageSize) || 500)));
if (paged) nearbySql += ' ORDER BY Id LIMIT @offset, @pageSize';

var nearbyQuery = V8.Db.FromSql(nearbySql)
  .AddInParameter('@p0', latitude)
  .AddInParameter('@p1', longitude)
  .AddInParameter('@p2', km)
  .AddInParameter('@p3', tenantId)
  .AddInParameter('@p4', canViewAllTenantDevices ? 1 : 0)
  .AddInParameter('@p5', currentUserId);
for (var rp = 0; rp < regionNames.length; rp++) nearbyQuery.AddInParameter('@region' + rp, regionNames[rp]);
if (paged) nearbyQuery.AddInParameter('@offset', (pageIndex - 1) * pageSize).AddInParameter('@pageSize', pageSize);
var nearbyDevices = nearbyQuery.ToArray();
V8.Result = { Code: 1, Data: nearbyDevices, DataCount: nearbyDevices.length, Msg: '',
  DataAppend: { ScopeProtocol: 1, HasMore: paged && nearbyDevices.length === pageSize } };
