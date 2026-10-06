using System;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8 专用对象存储代理。调用者不能覆盖租户、注入 ClientModel 或访问底层存储接口，
    /// 且所有对象路径都被固定在 /{OsClient}/ 命名空间内。
    /// </summary>
    public sealed class V8TenantHDFS : IV8HDFS
    {
        private readonly string _osClient;

        public V8TenantHDFS(string osClient)
        {
            _osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
        }

        public Task<DosResult> Upload(DiyUploadParam param)
        {
            Prepare(param);
            param.Path = TenantConfigurationSecurity.NormalizeUploadSubPath(_osClient, param.Path);
            return MicroiEngine.HDFS.Upload(param);
        }

        public Task<DosResult> GetPrivateFileUrl(DiyUploadParam param)
        {
            PrepareFilePaths(param);
            return MicroiEngine.HDFS.GetPrivateFileUrl(param);
        }

        public Task<DosResult> GetPrivateFileByte(DiyUploadParam param)
        {
            PrepareFilePaths(param);
            return MicroiEngine.HDFS.GetPrivateFileByte(param);
        }

        public Task<DosResult> ListObjects(DiyUploadParam param)
        {
            Prepare(param);
            param.Path = TenantConfigurationSecurity.NormalizeStoragePath(_osClient, param.Path, true);
            var storage = ResolveStorage();
            return storage.Client.ListObjects(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                Prefix = param.Path,
                Marker = param.Marker,
                MaxKeys = param.MaxKeys.GetValueOrDefault(1000),
                Recursive = param.Recursive,
                Keyword = param._Keyword
            });
        }

        public async Task<DosResult> DeleteObject(DiyUploadParam param)
        {
            Prepare(param);
            param.FilePathName = TenantConfigurationSecurity.NormalizeStorageDeletePath(_osClient, param.FilePathName);
            if (param.EmptyDirectoryOnly == true)
            {
                var denied = await HdfsObjectDeleteAuthorization.AuthorizeEmptyDirectoryAsync(_osClient).ConfigureAwait(false);
                if (denied != null) return denied;
                if (!param.Limit.HasValue) return new DosResult(0, null, "空目录标记删除必须明确选择公有或私有桶。");
            }
            var storage = ResolveStorage(param.EmptyDirectoryOnly == true);
            return await storage.Client.DeleteObject(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                EmptyDirectoryOnly = param.EmptyDirectoryOnly,
                FileFullPath = param.FilePathName
            }).ConfigureAwait(false);
        }

        public Task<DosResult> CreateFolder(DiyUploadParam param)
        {
            PrepareSinglePath(param);
            var storage = ResolveStorage();
            return storage.Client.CreateFolder(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                FileFullPath = param.FilePathName
            });
        }

        public Task<DosResult> RenameObject(DiyUploadParam param)
        {
            return MoveObject(param);
        }

        public Task<DosResult> MoveObject(DiyUploadParam param)
        {
            PrepareSinglePath(param);
            param.Path = TenantConfigurationSecurity.NormalizeStoragePath(_osClient, param.Path);
            var storage = ResolveStorage();
            return storage.Client.MoveObject(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                FileFullPath = param.FilePathName,
                DestPath = param.Path
            });
        }

        public Task<DosResult> CopyObject(DiyUploadParam param)
        {
            PrepareSinglePath(param);
            param.Path = TenantConfigurationSecurity.NormalizeStoragePath(_osClient, param.Path);
            var storage = ResolveStorage();
            return storage.Client.CopyObject(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                FileFullPath = param.FilePathName,
                DestPath = param.Path
            });
        }

        public Task<DosResult<bool>> ObjectExist(DiyUploadParam param)
        {
            PrepareSinglePath(param);
            var storage = ResolveStorage();
            return storage.Client.ObjectExist(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                FileFullPath = param.FilePathName
            });
        }

        public async Task<DosResult> GetObjectSha256(DiyUploadParam param)
        {
            PrepareSinglePath(param);
            var storage = ResolveStorage();
            using var digest = new V8ObjectHashStream();
            var result = await storage.Client.CopyObjectToStream(new HDFSParam
            {
                ClientModel = storage.ClientModel,
                Limit = param.Limit,
                FileFullPath = param.FilePathName,
                FileStream = digest
            }).ConfigureAwait(false);
            if (result.Code != 1) return result;
            var (sha256, wireSha256, size) = digest.Complete();
            return new DosResult(1, new { Sha256 = sha256, WireSha256 = wireSha256, Size = size });
        }

        private void PrepareFilePaths(DiyUploadParam param)
        {
            Prepare(param);
            if (!string.IsNullOrWhiteSpace(param.FilePathName))
            {
                param.FilePathName = TenantConfigurationSecurity.NormalizeStoragePath(_osClient, param.FilePathName);
            }
            if (param.FilePathNames != null)
            {
                param.FilePathNames = param.FilePathNames
                    .Select(path => TenantConfigurationSecurity.NormalizeStoragePath(_osClient, path))
                    .ToList();
            }
        }

        private void PrepareSinglePath(DiyUploadParam param)
        {
            Prepare(param);
            param.FilePathName = TenantConfigurationSecurity.NormalizeStoragePath(_osClient, param.FilePathName);
        }

        private void Prepare(DiyUploadParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            param.OsClient = _osClient;
            // 存储类型只由当前租户运行配置决定，V8 参数不能切换底层 provider。
            param.HDFS = null;
        }

        private StorageContext ResolveStorage(bool strictProvider = false)
        {
            var clientModel = OsClientExtend.GetClient(_osClient)
                              ?? throw new InvalidOperationException("当前租户运行配置不存在。");
            var hdfs = clientModel.OsClientModel?["HDFS"]?.ToString();
            if (strictProvider && !string.IsNullOrWhiteSpace(hdfs)
                && hdfs != "Aliyun" && hdfs != "MinIO" && hdfs != "S3")
                throw new InvalidOperationException("当前存储类型不支持严格空目录标记删除。");
            var client = hdfs switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
            return new StorageContext(client, clientModel);
        }

        private sealed class StorageContext
        {
            public StorageContext(IMicroiHDFS client, OsClientSecret clientModel)
            {
                Client = client;
                ClientModel = clientModel;
            }

            public IMicroiHDFS Client { get; }
            public OsClientSecret ClientModel { get; }
        }
    }
}
