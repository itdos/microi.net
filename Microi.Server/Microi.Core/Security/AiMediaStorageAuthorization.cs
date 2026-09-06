using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace Microi.net
{
    /// <summary>
    /// 仅可信媒体运行时可签发的单对象上传授权。授权不放进 DTO，不能经 HTTP、
    /// JSON 或可编辑 V8 伪造；只决定平台生成目录，租户上传开关、配额和载荷检查仍执行。
    /// </summary>
    internal static class AiMediaStorageAuthorization
    {
        private static readonly ConditionalWeakTable<DiyUploadParam, Grant> Grants = new ConditionalWeakTable<DiyUploadParam, Grant>();
        private static readonly HashSet<string> Roots = new HashSet<string>(StringComparer.Ordinal)
        { "ai-images", "ai-image-references", "ai-music", "ai-speech", "ai-video" };

        internal static DiyUploadParam Authorize(DiyUploadParam param)
        {
            var userId = param?._CurrentUser?["Id"]?.ToString();
            if (param == null || string.IsNullOrWhiteSpace(param.OsClient)
                || string.IsNullOrWhiteSpace(userId) || !Roots.Contains(param.Path ?? "")
                || param.Limit != (param.Path == "ai-image-references"))
                throw new InvalidOperationException("媒体存储授权需要真实租户、用户和固定公私目录。");
            Grants.Add(param, new Grant(param.OsClient, userId, param.Path, param.Limit.Value));
            return param;
        }

        internal static bool Allows(DiyUploadParam param)
            => param != null && Grants.TryGetValue(param, out var grant)
                && string.Equals(grant.Tenant, param.OsClient, StringComparison.Ordinal)
                && string.Equals(grant.User, param._CurrentUser?["Id"]?.ToString(), StringComparison.Ordinal)
                && string.Equals(grant.Path, param.Path, StringComparison.Ordinal)
                && grant.Private == param.Limit;

        private sealed class Grant
        {
            internal readonly string Tenant, User, Path;
            internal readonly bool Private;
            internal Grant(string tenant, string user, string path, bool isPrivate)
            { Tenant = tenant; User = user; Path = path; Private = isPrivate; }
        }
    }
}
