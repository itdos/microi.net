using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api
{
    public partial class HDFSController
    {
        [HttpPost]
        public async Task<JsonResult> ProbeMinio(MinioProbeParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().Probe(param));
        }

        [HttpPost]
        public async Task<JsonResult> ListMinioObjects(MinioListObjectsParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().ListObjects(param));
        }

        [HttpPost]
        public async Task<JsonResult> CreateMinioFolder(MinioCreateFolderParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().CreateFolder(param));
        }

        [HttpPost]
        public async Task<JsonResult> SyncMinioObject(MinioObjectSyncParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            param ??= new MinioObjectSyncParam();
            param.CurrentOsClient = access.OsClient;
            return Json(await new ExternalMinioSyncService().SyncObject(param));
        }

        private static async Task<(DosResult Result, string OsClient)> GetMinioSyncAccess()
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
                if (currentToken?.CurrentUser == null || currentToken.OsClient.DosIsNullOrWhiteSpace())
                {
                    return (new DosResult(1001, null, "登录身份已过期，请重新登录。"), "");
                }
                if (currentToken.CurrentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                {
                    return (new DosResult(0, null, "只有超级管理员可以配置直连MinIO并执行文件同步。"), "");
                }
                return (null, currentToken.OsClient);
            }
            catch
            {
                return (new DosResult(1001, null, "登录身份无效，请重新登录。"), "");
            }
        }
    }
}
