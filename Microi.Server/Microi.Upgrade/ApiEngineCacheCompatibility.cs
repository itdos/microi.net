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
        internal const string Marker = "MICROI_APIENGINE_CACHE_V3_COMPAT_V1";

        private const string RawObjectCacheWritePattern =
            @"V8\.Cache\.Set\((?<key>[^;\r\n]+?),\s*formModel\s*\);";

        private const string JsonFormModelAssignmentPattern =
            @"var\s+formModel\s*=\s*JSON\.stringify\(V8\.Form\)\s*;";

        internal const string SubmitAfterServerV8 = @"// MICROI_APIENGINE_CACHE_V3_COMPAT_V1
/*
 * V8 Event
 * TableKey: sys_apiengine
 * EventType: SubmitAfterServerV8
 * Version: v1.0.2
 * Function:
 * - 保存后刷新接口引擎缓存；局部更新时回查缺少的Key/地址。
 * - v3/v6共享Redis时统一写JSON文本，禁止写入System.Dynamic.ExpandoObject。
 */

var formModel = V8.Form || {};
var apiEngineKey = formModel.ApiEngineKey;
var apiEngineId = formModel.Id;
var apiAddress = formModel.ApiAddress;

if((!apiEngineKey || !apiEngineId) && formModel.Id){
  var latestResult = V8.FormEngine.GetFormData('sys_apiengine', {
    Id: formModel.Id,
    _SelectFields: ['Id', 'ApiEngineKey', 'ApiAddress']
  });
  if(latestResult && latestResult.Code == 1 && latestResult.Data){
    apiEngineKey = apiEngineKey || latestResult.Data.ApiEngineKey;
    apiEngineId = apiEngineId || latestResult.Data.Id;
    apiAddress = apiAddress || latestResult.Data.ApiAddress;
    formModel.ApiEngineKey = apiEngineKey;
    formModel.ApiAddress = apiAddress;
  }
}

if(apiEngineKey){
  V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(apiEngineKey).toLowerCase()}`, JSON.stringify(formModel));
}
if(apiEngineId){
  V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(apiEngineId).toLowerCase()}`, JSON.stringify(formModel));
}

if(V8.OldForm && V8.OldForm.ApiEngineKey && V8.OldForm.ApiEngineKey != apiEngineKey){
  V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(V8.OldForm.ApiEngineKey).toLowerCase()}`);
}

if(apiAddress){
  var apiPath = String(apiAddress).toLowerCase();
  V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${apiPath}`, JSON.stringify(formModel));
  if(V8.OldForm && V8.OldForm.ApiAddress && V8.OldForm.ApiAddress != apiAddress){
    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(V8.OldForm.ApiAddress).toLowerCase()}`);
  }
}
";

        /// <summary>
        /// Repairs only the platform-owned cache assignment and leaves any
        /// customer code around it byte-for-byte unchanged.
        /// </summary>
        internal static bool TryUpgradeEvent(string currentCode, out string upgradedCode)
        {
            upgradedCode = currentCode ?? "";
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
    }
}
