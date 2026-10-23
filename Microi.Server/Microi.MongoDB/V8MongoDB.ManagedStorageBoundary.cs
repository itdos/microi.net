using System;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8MongoDB
    {
        // 该集合只允许宿主 store 访问。普通引擎、Hook、管理员可编辑 V8 都不能
        // 读取票据或修改 Phase/Active；大小写和分页模式不能绕过同一边界。
        private static void RejectHostStorageCollection(string table, bool prefix = false)
        {
            const string reserved = "managed_storage_admission";
            var normalized = table?.Trim();
            if (string.IsNullOrEmpty(normalized)) return;
            if (string.Equals(normalized, reserved, StringComparison.OrdinalIgnoreCase)
                || prefix && reserved.StartsWith(normalized + "_", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("MongoDB 宿主协议存储不允许通过 V8 直接访问。");
        }
        private static void RejectHostStoragePage(JObject input)
        {
            // 分页目前精确读取属性名；所有大小写别名也一并拒绝，避免模式或
            // 序列化兼容层以后改为不区分大小写时重新开放宿主集合。
            foreach (var property in input.Properties())
            {
                if (string.Equals(property.Name, "TableName", StringComparison.OrdinalIgnoreCase))
                    RejectHostStorageCollection(property.Value.Value<string>());
                if (string.Equals(property.Name, "TablePrefix", StringComparison.OrdinalIgnoreCase))
                    RejectHostStorageCollection(property.Value.Value<string>(), true);
            }
        }
    }
}
