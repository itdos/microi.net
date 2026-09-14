using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>可信平台编排共用的按 Id 或业务键保存原子，调用方负责权限和资源归属。</summary>
    internal static class PlatformMetadataUpsertService
    {
        internal static async Task<DosResult<object>> SaveAsync(
            string osClient, string tableName, JObject data, string uniqueField, string displayName)
        {
            var id = data["Id"].Val<string>();
            if (!id.DosIsNullOrWhiteSpace())
            {
                var existingById = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new
                {
                    OsClient = osClient,
                    Id = id
                });
                if (existingById.Code == 1 && existingById.Data != null)
                {
                    var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(tableName, data);
                    if (uptResult.Code != 1) return new DosResult<object>(uptResult.Code, uptResult.Data, uptResult.Msg);
                    return new DosResult<object>(1, new { Id = id, Message = $"{displayName} 已更新", Updated = true });
                }
            }

            if (!uniqueField.DosIsNullOrWhiteSpace())
            {
                var keyValue = data[uniqueField].Val<string>();
                if (!keyValue.DosIsNullOrWhiteSpace())
                {
                    var existingByKey = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { uniqueField, "=", keyValue } }
                    });
                    if (existingByKey.Code == 1 && existingByKey.Data != null)
                    {
                        data["Id"] = (string)existingByKey.Data.Id;
                        var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(tableName, data);
                        if (uptResult.Code != 1) return new DosResult<object>(uptResult.Code, uptResult.Data, uptResult.Msg);
                        return new DosResult<object>(1, new { Id = (string)existingByKey.Data.Id, Message = $"{displayName} 已按 {uniqueField} 更新", Updated = true });
                    }
                }
            }

            if (data["Id"].Val<string>().DosIsNullOrWhiteSpace()) data["Id"] = Ulid.NewUlid().ToString();
            var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(tableName, data);
            if (addResult.Code != 1) return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            return new DosResult<object>(1, new { Id = data["Id"].Val<string>(), Message = $"{displayName} 已创建", Created = true });
        }
    }
}
