using System;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>
    /// Shared sys_apiengine table-event contract for rolling v3/v6 deployments.
    /// v3 Redis expects JSON text and turns a raw dynamic object into
    /// "System.Dynamic.ExpandoObject", which it cannot deserialize later.
    /// </summary>
    internal static class ApiEngineCacheCompatibility
    {
        internal const string Marker = "MICROI_APIENGINE_CACHE_MULTI_ROUTE_V2";
        private const string LegacyMarker = "MICROI_APIENGINE_CACHE_V3_COMPAT_V1";
        internal const string ValidationMarker = "MICROI_APIENGINE_MULTI_ROUTE_VALIDATE_V1";

        internal const string SubmitBeforeServerV8 = @"// MICROI_APIENGINE_MULTI_ROUTE_VALIDATE_V1
/*
 * V8 Event
 * TableKey: sys_apiengine
 * EventType: SubmitBeforeServerV8
 * Version: v1.0.0
 * Function:
 * - 校验 ApiAddress 与“多路由”格式；多路由使用英文分号分隔。
 * - 拒绝同一租户两个启用接口占用相同主路由/多路由，避免缓存覆盖与错调。
 */
if(V8.FormSubmitAction != 'Del'){
  var current = V8.Form || {};
  var primary = String(current.ApiAddress || '').trim();
  var rawRoutes = String(current.ApiRoutes || '');
  var seen = {};
  var routes = [];
  function validateRoute(route){
    if(!route || route.charAt(0) != '/' || route.length > 500
      || route.indexOf('\\') >= 0 || route.indexOf('?') >= 0 || route.indexOf('#') >= 0
      || route.indexOf('\r') >= 0 || route.indexOf('\n') >= 0){
      return '路由[' + route + ']必须以 / 开头、长度不超过500，且不能包含查询串、片段、反斜杠或换行。';
    }
    var segments = route.split('/').filter(function(segment){ return !!segment; });
    for(var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++){
      var segment = segments[segmentIndex];
      if((segment.indexOf('{') >= 0 || segment.indexOf('}') >= 0)
        && !/^\{[A-Za-z][A-Za-z0-9_]{0,63}\}$/.test(segment)){
        return '模板路由[' + route + ']的占位符必须独占完整路径段，并使用 {Name} 格式。';
      }
    }
    return '';
  }
  if(primary){
    var primaryError = validateRoute(primary);
    if(primaryError) return { Code:0, Msg:primaryError };
    seen[primary.toLowerCase()] = true;
  }
  rawRoutes.split(';').forEach(function(value){
    var route = String(value || '').trim();
    if(!route) return;
    var lower = route.toLowerCase();
    if(seen[lower]) return;
    seen[lower] = true;
    routes.push(route);
  });
  if(routes.length > 128) return { Code:0, Msg:'多路由最多允许128个地址。' };
  for(var routeIndex = 0; routeIndex < routes.length; routeIndex++){
    var routeError = validateRoute(routes[routeIndex]);
    if(routeError) return { Code:0, Msg:routeError };
  }
  current.ApiRoutes = routes.join(';');

  var candidates = V8.FormEngine.GetTableData('sys_apiengine', {
    _SelectFields:['Id','ApiEngineKey','ApiAddress','ApiRoutes','IsEnable','IsDeleted'],
    _PageIndex:1,
    _PageSize:100000
  });
  if(candidates && candidates.Code == 1 && candidates.Data){
    for(var rowIndex = 0; rowIndex < candidates.Data.length; rowIndex++){
      var row = candidates.Data[rowIndex];
      if(!row || String(row.Id || '').toLowerCase() == String(current.Id || '').toLowerCase()
        || Number(row.IsEnable || 0) != 1 || Number(row.IsDeleted || 0) == 1) continue;
      var otherAliases = [row.ApiAddress].concat(String(row.ApiRoutes || '').split(';'));
      for(var aliasIndex = 0; aliasIndex < otherAliases.length; aliasIndex++){
        var alias = String(otherAliases[aliasIndex] || '').trim();
        if(alias && seen[alias.toLowerCase()]){
          return { Code:0, Msg:'路由[' + alias + ']已被接口引擎[' + String(row.ApiEngineKey || row.Id) + ']占用。' };
        }
      }
    }
  }
}
";

        private const string RawObjectCacheWritePattern =
            @"V8\.Cache\.Set\((?<key>[^;\r\n]+?),\s*formModel\s*\);";

        private const string JsonFormModelAssignmentPattern =
            @"var\s+formModel\s*=\s*JSON\.stringify\(V8\.Form\)\s*;";

        internal const string SubmitAfterServerV8 = @"// MICROI_APIENGINE_CACHE_MULTI_ROUTE_V2
/*
 * V8 Event
 * TableKey: sys_apiengine
 * EventType: SubmitAfterServerV8
 * Version: v2.0.0
 * Function:
 * - 保存后刷新接口引擎 Id、Key、主路由和全部“多路由”缓存。
 * - 多路由使用英文分号分隔；变更或删除时清理全部旧别名。
 * - v3/v6共享Redis时统一写JSON文本，禁止写入System.Dynamic.ExpandoObject。
 */

var formModel = V8.Form || {};
var apiEngineKey = formModel.ApiEngineKey;
var apiEngineId = formModel.Id;
var apiAddress = formModel.ApiAddress;
var apiRoutes = formModel.ApiRoutes;

if((!apiEngineKey || !apiEngineId || typeof apiRoutes === 'undefined') && formModel.Id){
  var latestResult = V8.FormEngine.GetFormData('sys_apiengine', {
    Id: formModel.Id,
    _SelectFields: ['Id', 'ApiEngineKey', 'ApiAddress', 'ApiRoutes', 'IsDeleted']
  });
  if(latestResult && latestResult.Code == 1 && latestResult.Data){
    apiEngineKey = apiEngineKey || latestResult.Data.ApiEngineKey;
    apiEngineId = apiEngineId || latestResult.Data.Id;
    apiAddress = apiAddress || latestResult.Data.ApiAddress;
    if(typeof apiRoutes === 'undefined') apiRoutes = latestResult.Data.ApiRoutes;
    formModel.ApiEngineKey = apiEngineKey;
    formModel.ApiAddress = apiAddress;
    formModel.ApiRoutes = apiRoutes || '';
  }
}

function splitRoutes(value){
  if(!value) return [];
  var seen = {};
  return String(value).split(';').map(function(item){ return item.trim(); }).filter(function(item){
    var lower = item.toLowerCase();
    if(!item || seen[lower]) return false;
    seen[lower] = true;
    return true;
  });
}
function cacheKey(alias){
  return `Microi:${V8.OsClient}:FormData:sys_apiengine:${String(alias).trim().toLowerCase()}`;
}
function aliases(model){
  if(!model) return [];
  return [model.Id, model.ApiEngineKey, model.ApiAddress].concat(splitRoutes(model.ApiRoutes)).filter(function(item){ return !!item; });
}
aliases(V8.OldForm).forEach(function(alias){ V8.Cache.Remove(cacheKey(alias)); });
aliases(formModel).forEach(function(alias){ V8.Cache.Remove(cacheKey(alias)); });

if(!formModel.IsDeleted){
  var cacheJson = JSON.stringify(formModel);
  aliases(formModel).forEach(function(alias){ V8.Cache.Set(cacheKey(alias), cacheJson); });
}
";

        /// <summary>
        /// Repairs only the platform-owned cache assignment and leaves any
        /// customer code around it byte-for-byte unchanged.
        /// </summary>
        internal static bool TryUpgradeEvent(string currentCode, out string upgradedCode)
        {
            upgradedCode = currentCode ?? "";
            if (!string.IsNullOrWhiteSpace(currentCode)
                && currentCode.IndexOf(LegacyMarker, StringComparison.Ordinal) >= 0)
            {
                upgradedCode = SubmitAfterServerV8;
                return !string.Equals(currentCode, upgradedCode, StringComparison.Ordinal);
            }
            if (!string.IsNullOrWhiteSpace(currentCode)
                && currentCode.IndexOf(Marker, StringComparison.Ordinal) >= 0)
            {
                return false;
            }
            if (string.IsNullOrWhiteSpace(currentCode)
                || currentCode.IndexOf(
                    "FormData:sys_apiengine",
                    StringComparison.OrdinalIgnoreCase) < 0
                || currentCode.IndexOf(
                    "V8.Cache.Set",
                    StringComparison.Ordinal) < 0)
            {
                return false;
            }

            var formModelIsAlreadyJson = Regex.IsMatch(
                currentCode,
                JsonFormModelAssignmentPattern,
                RegexOptions.CultureInvariant);
            var normalized = formModelIsAlreadyJson
                ? currentCode
                : Regex.Replace(
                    currentCode,
                    RawObjectCacheWritePattern,
                    "V8.Cache.Set(${key}, JSON.stringify(formModel));",
                    RegexOptions.CultureInvariant);
            var hasCompatibleWrite = normalized.IndexOf(
                    "JSON.stringify(formModel)",
                    StringComparison.Ordinal) >= 0
                || formModelIsAlreadyJson;
            if (!hasCompatibleWrite
                || (!formModelIsAlreadyJson
                    && Regex.IsMatch(
                        normalized,
                        RawObjectCacheWritePattern,
                        RegexOptions.CultureInvariant)))
            {
                return false;
            }

            if (normalized.IndexOf(Marker, StringComparison.Ordinal) < 0)
            {
                normalized = "// " + Marker + Environment.NewLine + normalized;
            }

            upgradedCode = normalized;
            return !string.Equals(currentCode, upgradedCode, StringComparison.Ordinal);
        }

        internal static bool TryUpgradeValidationEvent(string currentCode, out string upgradedCode)
        {
            currentCode ??= string.Empty;
            if (currentCode.IndexOf(ValidationMarker, StringComparison.Ordinal) >= 0)
            {
                upgradedCode = currentCode;
                return false;
            }

            // 保留租户既有校验逻辑；平台协议块先执行，校验通过后才进入原事件。
            upgradedCode = SubmitBeforeServerV8
                + (string.IsNullOrWhiteSpace(currentCode)
                    ? string.Empty
                    : Environment.NewLine + currentCode);
            return true;
        }
    }
}
